function createCommonjsModule(fn, basedir, module) {
	return module = {
	  path: basedir,
	  exports: {},
	  require: function (path, base) {
      return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    }
	}, fn(module, module.exports), module.exports;
}

function commonjsRequire () {
	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
}

var runtime_1 = createCommonjsModule(function (module) {
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var runtime = (function (exports) {

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var undefined$1; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  exports.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  IteratorPrototype[iteratorSymbol] = function () {
    return this;
  };

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunctionPrototype[toStringTagSymbol] =
    GeneratorFunction.displayName = "GeneratorFunction";

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      prototype[method] = function(arg) {
        return this._invoke(method, arg);
      };
    });
  }

  exports.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  exports.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      if (!(toStringTagSymbol in genFun)) {
        genFun[toStringTagSymbol] = "GeneratorFunction";
      }
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  exports.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator, PromiseImpl) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return PromiseImpl.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return PromiseImpl.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration.
          result.value = unwrapped;
          resolve(result);
        }, function(error) {
          // If a rejected Promise was yielded, throw the rejection back
          // into the async generator function so it can be handled there.
          return invoke("throw", error, resolve, reject);
        });
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new PromiseImpl(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);
  AsyncIterator.prototype[asyncIteratorSymbol] = function () {
    return this;
  };
  exports.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
    if (PromiseImpl === void 0) PromiseImpl = Promise;

    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList),
      PromiseImpl
    );

    return exports.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];
    if (method === undefined$1) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        // Note: ["return"] must be used for ES3 parsing compatibility.
        if (delegate.iterator["return"]) {
          // If the delegate iterator has a return method, give it a
          // chance to clean up.
          context.method = "return";
          context.arg = undefined$1;
          maybeInvokeDelegate(delegate, context);

          if (context.method === "throw") {
            // If maybeInvokeDelegate(context) changed context.method from
            // "return" to "throw", let that override the TypeError below.
            return ContinueSentinel;
          }
        }

        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined$1;
      }

    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    }

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  Gp[toStringTagSymbol] = "Generator";

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  Gp[iteratorSymbol] = function() {
    return this;
  };

  Gp.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  exports.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined$1;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  exports.values = values;

  function doneResult() {
    return { value: undefined$1, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined$1;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined$1;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined$1;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined$1;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined$1;
      }

      return ContinueSentinel;
    }
  };

  // Regardless of whether this script is executing as a CommonJS module
  // or not, return the runtime object so that we can declare the variable
  // regeneratorRuntime in the outer scope, which allows this module to be
  // injected easily by `bin/regenerator --include-runtime script.js`.
  return exports;

}(
  // If this script is executing as a CommonJS module, use module.exports
  // as the regeneratorRuntime namespace. Otherwise create a new empty
  // object. Either way, the resulting object will be used to initialize
  // the regeneratorRuntime variable at the top of this file.
   module.exports 
));

try {
  regeneratorRuntime = runtime;
} catch (accidentalStrictMode) {
  // This module should not be running in strict mode, so the above
  // assignment should always work unless something is misconfigured. Just
  // in case runtime.js accidentally runs in strict mode, we can escape
  // strict mode using a global Function call. This could conceivably fail
  // if a Content Security Policy forbids using Function, but in that case
  // the proper solution is to fix the accidental strict mode problem. If
  // you've misconfigured your bundler to force strict mode and applied a
  // CSP to forbid Function, and you're not willing to fix either of those
  // problems, please detail your unique predicament in a GitHub issue.
  Function("r", "regeneratorRuntime = r")(runtime);
}
});

var regenerator = runtime_1;

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  try {
    var info = gen[key](arg);
    var value = info.value;
  } catch (error) {
    reject(error);
    return;
  }

  if (info.done) {
    resolve(value);
  } else {
    Promise.resolve(value).then(_next, _throw);
  }
}

function _asyncToGenerator(fn) {
  return function () {
    var self = this,
        args = arguments;
    return new Promise(function (resolve, reject) {
      var gen = fn.apply(self, args);

      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
      }

      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
      }

      _next(undefined);
    });
  };
}

var asyncToGenerator = _asyncToGenerator;

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing. The function also has a property 'clear' 
 * that is a function which will clear the timer to prevent previously scheduled executions. 
 *
 * @source underscore.js
 * @see http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
 * @param {Function} function to wrap
 * @param {Number} timeout in ms (`100`)
 * @param {Boolean} whether to execute at the beginning (`false`)
 * @api public
 */
function debounce(func, wait, immediate){
  var timeout, args, context, timestamp, result;
  if (null == wait) wait = 100;

  function later() {
    var last = Date.now() - timestamp;

    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
        context = args = null;
      }
    }
  }
  var debounced = function(){
    context = this;
    args = arguments;
    timestamp = Date.now();
    var callNow = immediate && !timeout;
    if (!timeout) timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    }

    return result;
  };

  debounced.clear = function() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  debounced.flush = function() {
    if (timeout) {
      result = func.apply(context, args);
      context = args = null;
      
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}
// Adds compatibility for ES modules
debounce.debounce = debounce;

var debounce_1 = debounce;

function isScrollable(node) {
  var scrollRegex = /(auto|scroll)/;

  function getStyle(node, prop) {
    getComputedStyle(node, null).getPropertyValue(prop);
  }

  return scrollRegex.test(getStyle(node, 'overflow')) || scrollRegex.test(getStyle(node, 'overflow-x')) || scrollRegex.test(getStyle(node, 'overflow-y'));
}
function getFirstScrollableParent(node) {
  var parentNode = node && node.parentNode;

  if (!parentNode || parentNode === document.body) {
    return document.body;
  } else if (isScrollable(parentNode)) {
    return parentNode;
  } else {
    return getFirstScrollableParent(parentNode);
  }
}

var uid = 0;
var script = {
  props: {
    items: {
      type: Array,
      "default": function _default() {
        return [];
      }
    },
    keyField: {
      type: String,
      "default": 'id'
    },
    prerender: {
      type: Number,
      "default": 0
    },
    itemSize: {
      type: Number,
      "default": null
    },
    buffer: {
      type: Number,
      "default": 10
    },
    typeField: {
      type: String,
      "default": 'type'
    }
  },
  data: function data() {
    return {
      scrollableParent: null,
      totalHeight: null,
      ready: false,
      pool: [],
      sizeCache: new Map(),
      views: new Map(),
      unusedViews: new Map(),
      averageItemSize: 0,
      anchorItem: {
        index: 0,
        offset: 0
      },
      firstAttachedItem: 0,
      lastAttachedItem: 0,
      anchorScrollTop: 0,
      scrollEnd: 0
    };
  },
  watch: {
    items: function items() {
      var _this = this;

      return asyncToGenerator( /*#__PURE__*/regenerator.mark(function _callee() {
        return regenerator.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return _this.updateVisibleItems(true);

              case 2:
              case "end":
                return _context.stop();
            }
          }
        }, _callee);
      }))();
    }
  },
  created: function created() {
    this.$_scrollDirty = false;
    this.$_window_width = null;
    this.debouncedUpdatePositions = debounce_1(this.updateItemsPosition, 100); // In SSR mode, we also prerender the same number of item for the first render
    // to avoid mismatch between server and client templates

    if (this.prerender) {
      this.$_prerender = true;
      this.updateVisibleItems(false);
    }
  },
  mounted: function mounted() {
    this.init();
  },
  beforeDestroy: function beforeDestroy() {
    this.removeEventListeners();
    clearTimeout(this.$_refreshTimout);
  },
  methods: {
    getFirstScrollableParent: function getFirstScrollableParent$1() {
      return getFirstScrollableParent(this.$el);
    },
    init: function init() {
      var _this2 = this;

      return asyncToGenerator( /*#__PURE__*/regenerator.mark(function _callee2() {
        var scrollableParent;
        return regenerator.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _this2.$_window_width = window.innerWidth;
                scrollableParent = _this2.getFirstScrollableParent();

                if (scrollableParent !== document.body) {
                  _this2.scrollableParent = scrollableParent;
                }

                _this2.addEventListeners(); // In SSR mode, render the real number of visible items


                _this2.$_prerender = false;
                _context2.next = 7;
                return _this2.updateVisibleItems(true);

              case 7:
                _this2.ready = true;

              case 8:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2);
      }))();
    },
    addEventListeners: function addEventListeners() {
      if (!this.scrollableParent) {
        window.addEventListener('scroll', this.onScroll);
      } else {
        this.scrollableParent.addEventListener('scroll', this.onScroll);
      }

      window.addEventListener('resize', this.onResize);
    },
    removeEventListeners: function removeEventListeners() {
      if (!this.scrollableParent) {
        window.removeEventListener('scroll', this.onScroll);
      } else {
        this.scrollableParent.removeEventListener('scroll', this.onScroll);
      }

      window.removeEventListener('resize', this.onResize);
    },
    onScroll: function onScroll() {
      var _this3 = this;

      if (!this.$_scrollDirty) {
        this.$_scrollDirty = true;
        requestAnimationFrame( /*#__PURE__*/asyncToGenerator( /*#__PURE__*/regenerator.mark(function _callee3() {
          var scrollResult, continuous;
          return regenerator.wrap(function _callee3$(_context3) {
            while (1) {
              switch (_context3.prev = _context3.next) {
                case 0:
                  _this3.$_scrollDirty = false;
                  _context3.next = 3;
                  return _this3.updateVisibleItems(false, true);

                case 3:
                  scrollResult = _context3.sent;
                  continuous = scrollResult && scrollResult.continuous; // It seems sometimes chrome doesn't fire scroll event :/
                  // When non continous scrolling is ending, we force a refresh

                  if (!continuous) {
                    clearTimeout(_this3.$_refreshTimout);
                    _this3.$_refreshTimout = setTimeout(_this3.onScroll, 100);
                  }

                case 6:
                case "end":
                  return _context3.stop();
              }
            }
          }, _callee3);
        })));
      }
    },
    onResize: function onResize() {
      if (this.$_window_width !== window.innerWidth) {
        this.clearSizeCache();

        if (this.ready) {
          this.updateVisibleItems(false);
        }
      }
    },
    clearSizeCache: function clearSizeCache() {
      this.averageItemSize = 0;
      this.sizeCache.clear();
    },
    calculateAnchoredItem: function calculateAnchoredItem(initialAnchor, delta) {
      var keyField = this.keyField;

      if (delta === 0) {
        return initialAnchor;
      } else {
        delta += initialAnchor.offset;
        var i = initialAnchor.index;

        if (delta < 0) {
          while (delta < 0 && i > 0) {
            var key = keyField ? this.items[i - 1][keyField] : this.items[i - 1];
            var height = this.sizeCache.get(key) || this.averageItemSize;
            delta += height;
            i--;
          }
        } else {
          while (delta > 0 && i <= this.items.length - 1) {
            var _key = keyField ? this.items[i][keyField] : this.items[i];

            var _height = this.sizeCache.get(_key) || this.averageItemSize;

            var nextDelta = delta - _height;

            if (nextDelta <= 0) {
              break;
            }

            delta = nextDelta;
            i++;
          }
        }

        return {
          index: i,
          offset: delta
        };
      }
    },
    updateVisibleItems: function updateVisibleItems(checkItem) {
      var _arguments = arguments,
          _this4 = this;

      return asyncToGenerator( /*#__PURE__*/regenerator.mark(function _callee4() {
        var checkPositionDiff, items, count, itemSize, averageItemSize, buffer, views, unusedViews, keyField, typeField, pool, prevFirstAttachedItem, prevLastAttachedItem, rerender, scroll, delta, startPositionDiff, endPositionDiff, minScroll, lastScreenItem, continuous, unusedIndex, item, type, unusedPool, v, view, i, key;
        return regenerator.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                checkPositionDiff = _arguments.length > 1 && _arguments[1] !== undefined ? _arguments[1] : false;
                items = _this4.items;
                count = items.length;
                itemSize = _this4.itemSize;
                averageItemSize = _this4.averageItemSize;
                buffer = _this4.buffer;
                views = _this4.views;
                unusedViews = _this4.unusedViews;
                keyField = _this4.keyField;
                typeField = _this4.typeField;
                pool = _this4.pool;
                prevFirstAttachedItem = _this4.firstAttachedItem;
                prevLastAttachedItem = _this4.lastAttachedItem;
                rerender = false;

                if (count) {
                  _context4.next = 21;
                  break;
                }

                _this4.firstAttachedItem = 0;
                _this4.lastAttachedItem = 0;
                _this4.totalHeight = 0;
                return _context4.abrupt("return");

              case 21:
                if (!_this4.$_prerender) {
                  _context4.next = 28;
                  break;
                }

                _this4.firstAttachedItem = 0;
                _this4.lastAttachedItem = Math.min(_this4.prerender, count - 1);
                _this4.totalHeight = null;
                return _context4.abrupt("return");

              case 28:
                if (!(!itemSize && !averageItemSize)) {
                  _context4.next = 33;
                  break;
                }

                // render an initial number of items to estimate item size
                _this4.lastAttachedItem = Math.min(_this4.firstAttachedItem + 20, count - 1);
                rerender = true;
                _context4.next = 49;
                break;

              case 33:
                scroll = _this4.getScroll();
                delta = scroll.start - _this4.anchorScrollTop; // Skip update if user hasn't scrolled enough

                if (!checkPositionDiff) {
                  _context4.next = 43;
                  break;
                }

                startPositionDiff = delta;
                endPositionDiff = scroll.end - _this4.scrollEnd;
                startPositionDiff = startPositionDiff < 0 ? -startPositionDiff : startPositionDiff;
                endPositionDiff = endPositionDiff < 0 ? -endPositionDiff : endPositionDiff;
                minScroll = itemSize || averageItemSize || 0;

                if (!(startPositionDiff < minScroll && endPositionDiff < minScroll)) {
                  _context4.next = 43;
                  break;
                }

                return _context4.abrupt("return", {
                  continuous: true
                });

              case 43:
                if (scroll.start === 0) {
                  _this4.anchorItem = {
                    index: 0,
                    offset: 0
                  };
                } else {
                  _this4.anchorItem = _this4.calculateAnchoredItem(_this4.anchorItem, delta);
                }

                _this4.anchorScrollTop = scroll.start;
                _this4.scrollEnd = scroll.end;
                lastScreenItem = _this4.calculateAnchoredItem(_this4.anchorItem, scroll.end - scroll.start);
                _this4.firstAttachedItem = Math.max(0, _this4.anchorItem.index - buffer);
                _this4.lastAttachedItem = Math.min(count - 1, lastScreenItem.index + buffer);

              case 49:
                // Collect unused views
                continuous = _this4.firstAttachedItem <= prevLastAttachedItem && _this4.lastAttachedItem >= prevFirstAttachedItem;

                if (_this4.continuous !== continuous) {
                  if (continuous) {
                    views.clear();
                    unusedViews.clear();

                    _this4.pool.forEach(function (view) {
                      _this4.unuseView(view);
                    });
                  }

                  _this4.continuous = continuous;
                } else if (continuous) {
                  _this4.pool.forEach(function (view) {
                    if (view.nr.used) {
                      // Update view item index
                      if (checkItem) {
                        view.nr.index = items.findIndex(function (item) {
                          return _this4.keyField ? item[keyField] === view.item[keyField] : item === view.item;
                        });
                      } // Check if index is still in visible range


                      if (view.nr.index === -1 || view.nr.index < _this4.firstAttachedItem || view.nr.index > _this4.lastAttachedItem) {
                        _this4.unuseView(view);
                      }
                    }
                  });
                } // Use or create views


                unusedIndex = continuous ? null : new Map();
                i = _this4.firstAttachedItem;

              case 53:
                if (!(i <= _this4.lastAttachedItem)) {
                  _context4.next = 63;
                  break;
                }

                item = items[i];
                key = keyField ? item[keyField] : item;

                if (!(key == null)) {
                  _context4.next = 58;
                  break;
                }

                throw new Error("Key is ".concat(key, " on item (keyField is '").concat(keyField, "')"));

              case 58:
                view = views.get(key); // No view assigned to item

                if (!view) {
                  type = item[typeField] || 'untyped';
                  unusedPool = unusedViews.get(type);

                  if (continuous) {
                    // Reuse existing view
                    if (unusedPool && unusedPool.length) {
                      view = unusedPool.pop();
                      view.item = item;
                      view.nr.used = true;
                      view.nr.index = i;
                      view.nr.key = key;
                      view.nr.type = type;
                    } else {
                      view = _this4.addView(pool, i, item, key, type);
                    }
                  } else {
                    // Use existing view
                    // We don't care if they are already used
                    // because we are not in continous scrolling
                    v = unusedIndex.get(type) || 0;

                    if (!unusedPool || v >= unusedPool.length) {
                      view = _this4.addView(pool, i, item, key, type);

                      _this4.unuseView(view, true);

                      unusedPool = unusedViews.get(type);
                    }

                    view = unusedPool[v];
                    view.item = item;
                    view.nr.used = true;
                    view.nr.index = i;
                    view.nr.key = key;
                    view.nr.type = type;
                    unusedIndex.set(type, v + 1);
                    v++;
                  }

                  views.set(key, view);
                } else {
                  view.nr.used = true;
                  view.item = item;
                }

              case 60:
                i++;
                _context4.next = 53;
                break;

              case 63:
                _context4.next = 65;
                return _this4.$nextTick();

              case 65:
                _this4.measureItems();

                _this4.totalHeight = _this4.calculateTotalHeight();

                _this4.fixScrollPosition();

                _this4.debouncedUpdatePositions();

                if (!rerender) {
                  _context4.next = 74;
                  break;
                }

                _context4.next = 72;
                return _this4.$nextTick();

              case 72:
                _context4.next = 74;
                return _this4.updateVisibleItems(checkItem);

              case 74:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4);
      }))();
    },
    getScroll: function getScroll() {
      var el = this.$el;
      var scrollState;

      if (!this.scrollableParent) {
        var bounds = el.getBoundingClientRect();
        var boundsSize = bounds.height;
        var start = -bounds.top;
        var size = window.innerHeight;

        if (start < 0) {
          size += start;
          start = 0;
        }

        if (start + size > boundsSize) {
          size = boundsSize - start;
        }

        scrollState = {
          start: start,
          end: start + size
        };
      } else {
        scrollState = {
          start: this.scrollableParent.scrollTop,
          end: this.scrollableParent.scrollTop + this.scrollableParent.clientHeight
        };
      }

      return scrollState;
    },
    calculateTotalHeight: function calculateTotalHeight() {
      var keyField = this.keyField;

      if (this.itemSize) {
        return this.itemSize * this.items.length;
      }

      var height = 0;

      for (var i = 0; i < this.items.length; i++) {
        var key = keyField ? this.items[i][keyField] : this.items[i];
        height += this.sizeCache.get(key) || this.averageItemSize || 0;
      }

      return height;
    },
    unuseView: function unuseView(view) {
      var fake = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      var unusedViews = this.unusedViews;
      var type = view.nr.type;
      var unusedPool = unusedViews.get(type);

      if (!unusedPool) {
        unusedPool = [];
        unusedViews.set(type, unusedPool);
      }

      unusedPool.push(view);

      if (!fake) {
        view.nr.used = false;
        view.position = -9999;
        this.views["delete"](view.nr.key);
      }
    },
    addView: function addView(pool, index, item, key, type) {
      var view = {
        item: item,
        position: 0
      };
      var nonReactive = {
        id: uid++,
        index: index,
        used: true,
        key: key,
        type: type
      };
      Object.defineProperty(view, 'nr', {
        configurable: false,
        value: nonReactive
      });
      pool.push(view);
      return view;
    },
    measureItems: function measureItems() {
      var _this5 = this;

      var poolDomElements = this.$refs.listviewItem;
      var hasUpdated = false;
      poolDomElements.forEach(function (poolDomElement, index) {
        var view = _this5.pool[index];

        if (view.nr.used) {
          var height = poolDomElement.offsetHeight;
          var key = view.nr.key;

          if (!_this5.sizeCache.has(key) || _this5.sizeCache.get(key) !== height) {
            hasUpdated = true;

            _this5.sizeCache.set(key, height);
          }
        }
      });

      if (hasUpdated) {
        var sizesCount = this.sizeCache.size;
        var sizesSum = 0;
        this.sizeCache.forEach(function (size) {
          sizesSum += size;
        });
        var averageItemSize = sizesSum / sizesCount;
        this.averageItemSize = averageItemSize;
      }
    },
    fixScrollPosition: function fixScrollPosition() {
      var anchorScrollTop = 0;

      for (var i = 0; i < this.anchorItem.index; i++) {
        var keyField = this.keyField;
        var key = keyField ? this.items[i][keyField] : this.items[i];
        anchorScrollTop += this.sizeCache.get(key) || this.averageItemSize || 0;
      }

      anchorScrollTop += this.anchorItem.offset;
      this.anchorScrollTop = anchorScrollTop;
    },
    updateItemsPosition: function updateItemsPosition() {
      var keyField = this.keyField; // Position all nodes.

      var curPos = this.anchorScrollTop - this.anchorItem.offset;
      var i = this.anchorItem.index;

      while (i > this.firstAttachedItem) {
        var key = keyField ? this.items[i - 1][keyField] : this.items[i - 1];
        curPos -= this.sizeCache.get(key) || this.averageItemSize || 0;
        i--;
      }

      while (i < this.firstAttachedItem) {
        var _key2 = keyField ? this.items[i][keyField] : this.items[i];

        curPos += this.sizeCache.get(_key2) || this.averageItemSize || 0;
        i++;
      }

      for (var _i = this.firstAttachedItem; _i <= this.lastAttachedItem; _i++) {
        var _key3 = keyField ? this.items[_i][keyField] : this.items[_i];

        var view = this.views.get(_key3);
        view.position = curPos;
        curPos += this.sizeCache.get(_key3) || this.averageItemSize || 0;
      }
    }
  }
};

function normalizeComponent(template, style, script, scopeId, isFunctionalTemplate, moduleIdentifier /* server only */, shadowMode, createInjector, createInjectorSSR, createInjectorShadow) {
    if (typeof shadowMode !== 'boolean') {
        createInjectorSSR = createInjector;
        createInjector = shadowMode;
        shadowMode = false;
    }
    // Vue.extend constructor export interop.
    const options = typeof script === 'function' ? script.options : script;
    // render functions
    if (template && template.render) {
        options.render = template.render;
        options.staticRenderFns = template.staticRenderFns;
        options._compiled = true;
        // functional template
        if (isFunctionalTemplate) {
            options.functional = true;
        }
    }
    // scopedId
    if (scopeId) {
        options._scopeId = scopeId;
    }
    let hook;
    if (moduleIdentifier) {
        // server build
        hook = function (context) {
            // 2.3 injection
            context =
                context || // cached call
                    (this.$vnode && this.$vnode.ssrContext) || // stateful
                    (this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext); // functional
            // 2.2 with runInNewContext: true
            if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
                context = __VUE_SSR_CONTEXT__;
            }
            // inject component styles
            if (style) {
                style.call(this, createInjectorSSR(context));
            }
            // register component module identifier for async chunk inference
            if (context && context._registeredComponents) {
                context._registeredComponents.add(moduleIdentifier);
            }
        };
        // used by ssr in case component is cached and beforeCreate
        // never gets called
        options._ssrRegister = hook;
    }
    else if (style) {
        hook = shadowMode
            ? function (context) {
                style.call(this, createInjectorShadow(context, this.$root.$options.shadowRoot));
            }
            : function (context) {
                style.call(this, createInjector(context));
            };
    }
    if (hook) {
        if (options.functional) {
            // register for functional component in vue file
            const originalRender = options.render;
            options.render = function renderWithStyleInjection(h, context) {
                hook.call(context);
                return originalRender(h, context);
            };
        }
        else {
            // inject component registration as beforeCreate hook
            const existing = options.beforeCreate;
            options.beforeCreate = existing ? [].concat(existing, hook) : [hook];
        }
    }
    return script;
}

/* script */
const __vue_script__ = script;
/* template */
var __vue_render__ = function() {
  var _vm = this;
  var _h = _vm.$createElement;
  var _c = _vm._self._c || _h;
  return _c(
    "div",
    {
      staticClass: "listview",
      class: { ready: _vm.ready },
      style: {
        height: _vm.totalHeight !== null ? _vm.totalHeight + "px" : null
      }
    },
    _vm._l(_vm.pool, function(view) {
      return _c(
        "div",
        {
          key: view.nr.id,
          ref: "listviewItem",
          refInFor: true,
          staticClass: "listview__item",
          style: _vm.ready
            ? { transform: "translateY(" + view.position + "px)" }
            : null
        },
        [
          _vm._t("default", null, {
            item: view.item,
            index: view.nr.index,
            active: view.nr.used
          })
        ],
        2
      )
    }),
    0
  )
};
var __vue_staticRenderFns__ = [];
__vue_render__._withStripped = true;

  /* style */
  const __vue_inject_styles__ = undefined;
  /* scoped */
  const __vue_scope_id__ = "data-v-4c000c37";
  /* module identifier */
  const __vue_module_identifier__ = undefined;
  /* functional template */
  const __vue_is_functional_template__ = false;
  /* style inject */
  
  /* style inject SSR */
  
  /* style inject shadow dom */
  

  
  const __vue_component__ = /*#__PURE__*/normalizeComponent(
    { render: __vue_render__, staticRenderFns: __vue_staticRenderFns__ },
    __vue_inject_styles__,
    __vue_script__,
    __vue_scope_id__,
    __vue_is_functional_template__,
    __vue_module_identifier__,
    false,
    undefined,
    undefined,
    undefined
  );

function install(Vue) {
  if (install.installed) return;
  install.installed = true;
  Vue.component('ListView', __vue_component__);
}
var plugin = {
  install: install
};
var GlobalVue = null;

if (typeof window !== 'undefined') {
  GlobalVue = window.Vue;
} else if (typeof global !== 'undefined') {
  GlobalVue = global.Vue;
}

if (GlobalVue) {
  GlobalVue.use(plugin);
} // To allow use as module (npm/webpack/etc.) export component

export default __vue_component__;
export { install };
//# sourceMappingURL=virtual-list.esm.js.map
