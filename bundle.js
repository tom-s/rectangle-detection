(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
const jsfeat = require("jsfeat");
const dat = require("dat-gui");
const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
const height = canvas.height;
const width = canvas.width;
const image = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
const contourTimeout = 100;
const maxArea = width * height;
const options = {
    blur_radius: 2,
    low_threshold: 20,
    high_threshold: 50,
};

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia || navigator.msGetUserMedia;

const onerror = function (error) {
    console.error(error);
};

const setupGUI = () => {
    const gui = new dat.GUI();

    gui.add(options, "blur_radius", 0, 4).step(1);
    gui.add(options, "low_threshold", 1, 127).step(1);
    gui.add(options, "high_threshold", 1, 127).step(1);
}

const drawPoly = (context, points) => {
    if (!points) {
        return;
    }

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length; i++) {
        context.lineTo(points[i].x, points[i].y);
    }

    context.closePath();
    context.strokeStyle = "#ff0000";
    context.lineWidth = 4;
    context.stroke();
}

let maxContour;

const contourFinderWorker = new Worker("js/contour-worker.js");
contourFinderWorker.addEventListener("message", function (e) {
    maxContour = e.data;
});
const throttle = (fn, time) => {
    let wait = false;

    return function () {
        if (!wait) {
            setTimeout(function () {
                wait = false;
            }, time);

            fn.apply(null, arguments);
            wait = true;
        }
    };
};
const throttledContourFind = throttle((imageData) => contourFinderWorker.postMessage(imageData), 200);

const tick = () => {
    requestAnimationFrame(tick);

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        context.drawImage(video, 0, 0, 640, 480);

        const imageData = context.getImageData(0, 0, 640, 480);
        jsfeat.imgproc.grayscale(imageData.data, 640, 480, image);

        const r = options.blur_radius|0;
        const kernel_size = (r+1) << 1;

        jsfeat.imgproc.gaussian_blur(image, image, kernel_size, 0);
        jsfeat.imgproc.canny(image, image, options.low_threshold|0, options.high_threshold|0);

        // render result back to canvas
        let data_u32 = new Uint32Array(imageData.data.buffer);
        const alpha = (0xff << 24);
        let i = image.cols*image.rows, pix = 0;

        while(--i >= 0) {
            pix = image.data[i];
            data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;
        }
        context.putImageData(imageData, 0, 0);
        drawPoly(context, maxContour);
        throttledContourFind(imageData);
    }
}

if (!!navigator.getUserMedia) {
    setupGUI();

    navigator.getUserMedia({ video: true }, function (localMediaStream) {
        video.src = window.URL.createObjectURL(localMediaStream);

        requestAnimationFrame(tick);
    }, onerror);
} else {
    alert("getUserMedia is not supported in your browser");
}

},{"dat-gui":2,"jsfeat":5}],2:[function(require,module,exports){
module.exports = require('./vendor/dat.gui')
module.exports.color = require('./vendor/dat.color')
},{"./vendor/dat.color":3,"./vendor/dat.gui":4}],3:[function(require,module,exports){
/**
 * dat-gui JavaScript Controller Library
 * http://code.google.com/p/dat-gui
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/** @namespace */
var dat = module.exports = dat || {};

/** @namespace */
dat.color = dat.color || {};

/** @namespace */
dat.utils = dat.utils || {};

dat.utils.common = (function () {
  
  var ARR_EACH = Array.prototype.forEach;
  var ARR_SLICE = Array.prototype.slice;

  /**
   * Band-aid methods for things that should be a lot easier in JavaScript.
   * Implementation and structure inspired by underscore.js
   * http://documentcloud.github.com/underscore/
   */

  return { 
    
    BREAK: {},
  
    extend: function(target) {
      
      this.each(ARR_SLICE.call(arguments, 1), function(obj) {
        
        for (var key in obj)
          if (!this.isUndefined(obj[key])) 
            target[key] = obj[key];
        
      }, this);
      
      return target;
      
    },
    
    defaults: function(target) {
      
      this.each(ARR_SLICE.call(arguments, 1), function(obj) {
        
        for (var key in obj)
          if (this.isUndefined(target[key])) 
            target[key] = obj[key];
        
      }, this);
      
      return target;
    
    },
    
    compose: function() {
      var toCall = ARR_SLICE.call(arguments);
            return function() {
              var args = ARR_SLICE.call(arguments);
              for (var i = toCall.length -1; i >= 0; i--) {
                args = [toCall[i].apply(this, args)];
              }
              return args[0];
            }
    },
    
    each: function(obj, itr, scope) {

      
      if (ARR_EACH && obj.forEach === ARR_EACH) { 
        
        obj.forEach(itr, scope);
        
      } else if (obj.length === obj.length + 0) { // Is number but not NaN
        
        for (var key = 0, l = obj.length; key < l; key++)
          if (key in obj && itr.call(scope, obj[key], key) === this.BREAK) 
            return;
            
      } else {

        for (var key in obj) 
          if (itr.call(scope, obj[key], key) === this.BREAK)
            return;
            
      }
            
    },
    
    defer: function(fnc) {
      setTimeout(fnc, 0);
    },
    
    toArray: function(obj) {
      if (obj.toArray) return obj.toArray();
      return ARR_SLICE.call(obj);
    },

    isUndefined: function(obj) {
      return obj === undefined;
    },
    
    isNull: function(obj) {
      return obj === null;
    },
    
    isNaN: function(obj) {
      return obj !== obj;
    },
    
    isArray: Array.isArray || function(obj) {
      return obj.constructor === Array;
    },
    
    isObject: function(obj) {
      return obj === Object(obj);
    },
    
    isNumber: function(obj) {
      return obj === obj+0;
    },
    
    isString: function(obj) {
      return obj === obj+'';
    },
    
    isBoolean: function(obj) {
      return obj === false || obj === true;
    },
    
    isFunction: function(obj) {
      return Object.prototype.toString.call(obj) === '[object Function]';
    }
  
  };
    
})();


dat.color.toString = (function (common) {

  return function(color) {

    if (color.a == 1 || common.isUndefined(color.a)) {

      var s = color.hex.toString(16);
      while (s.length < 6) {
        s = '0' + s;
      }

      return '#' + s;

    } else {

      return 'rgba(' + Math.round(color.r) + ',' + Math.round(color.g) + ',' + Math.round(color.b) + ',' + color.a + ')';

    }

  }

})(dat.utils.common);


dat.Color = dat.color.Color = (function (interpret, math, toString, common) {

  var Color = function() {

    this.__state = interpret.apply(this, arguments);

    if (this.__state === false) {
      throw 'Failed to interpret color arguments';
    }

    this.__state.a = this.__state.a || 1;


  };

  Color.COMPONENTS = ['r','g','b','h','s','v','hex','a'];

  common.extend(Color.prototype, {

    toString: function() {
      return toString(this);
    },

    toOriginal: function() {
      return this.__state.conversion.write(this);
    }

  });

  defineRGBComponent(Color.prototype, 'r', 2);
  defineRGBComponent(Color.prototype, 'g', 1);
  defineRGBComponent(Color.prototype, 'b', 0);

  defineHSVComponent(Color.prototype, 'h');
  defineHSVComponent(Color.prototype, 's');
  defineHSVComponent(Color.prototype, 'v');

  Object.defineProperty(Color.prototype, 'a', {

    get: function() {
      return this.__state.a;
    },

    set: function(v) {
      this.__state.a = v;
    }

  });

  Object.defineProperty(Color.prototype, 'hex', {

    get: function() {

      if (!this.__state.space !== 'HEX') {
        this.__state.hex = math.rgb_to_hex(this.r, this.g, this.b);
      }

      return this.__state.hex;

    },

    set: function(v) {

      this.__state.space = 'HEX';
      this.__state.hex = v;

    }

  });

  function defineRGBComponent(target, component, componentHexIndex) {

    Object.defineProperty(target, component, {

      get: function() {

        if (this.__state.space === 'RGB') {
          return this.__state[component];
        }

        recalculateRGB(this, component, componentHexIndex);

        return this.__state[component];

      },

      set: function(v) {

        if (this.__state.space !== 'RGB') {
          recalculateRGB(this, component, componentHexIndex);
          this.__state.space = 'RGB';
        }

        this.__state[component] = v;

      }

    });

  }

  function defineHSVComponent(target, component) {

    Object.defineProperty(target, component, {

      get: function() {

        if (this.__state.space === 'HSV')
          return this.__state[component];

        recalculateHSV(this);

        return this.__state[component];

      },

      set: function(v) {

        if (this.__state.space !== 'HSV') {
          recalculateHSV(this);
          this.__state.space = 'HSV';
        }

        this.__state[component] = v;

      }

    });

  }

  function recalculateRGB(color, component, componentHexIndex) {

    if (color.__state.space === 'HEX') {

      color.__state[component] = math.component_from_hex(color.__state.hex, componentHexIndex);

    } else if (color.__state.space === 'HSV') {

      common.extend(color.__state, math.hsv_to_rgb(color.__state.h, color.__state.s, color.__state.v));

    } else {

      throw 'Corrupted color state';

    }

  }

  function recalculateHSV(color) {

    var result = math.rgb_to_hsv(color.r, color.g, color.b);

    common.extend(color.__state,
        {
          s: result.s,
          v: result.v
        }
    );

    if (!common.isNaN(result.h)) {
      color.__state.h = result.h;
    } else if (common.isUndefined(color.__state.h)) {
      color.__state.h = 0;
    }

  }

  return Color;

})(dat.color.interpret = (function (toString, common) {

  var result, toReturn;

  var interpret = function() {

    toReturn = false;

    var original = arguments.length > 1 ? common.toArray(arguments) : arguments[0];

    common.each(INTERPRETATIONS, function(family) {

      if (family.litmus(original)) {

        common.each(family.conversions, function(conversion, conversionName) {

          result = conversion.read(original);

          if (toReturn === false && result !== false) {
            toReturn = result;
            result.conversionName = conversionName;
            result.conversion = conversion;
            return common.BREAK;

          }

        });

        return common.BREAK;

      }

    });

    return toReturn;

  };

  var INTERPRETATIONS = [

    // Strings
    {

      litmus: common.isString,

      conversions: {

        THREE_CHAR_HEX: {

          read: function(original) {

            var test = original.match(/^#([A-F0-9])([A-F0-9])([A-F0-9])$/i);
            if (test === null) return false;

            return {
              space: 'HEX',
              hex: parseInt(
                  '0x' +
                      test[1].toString() + test[1].toString() +
                      test[2].toString() + test[2].toString() +
                      test[3].toString() + test[3].toString())
            };

          },

          write: toString

        },

        SIX_CHAR_HEX: {

          read: function(original) {

            var test = original.match(/^#([A-F0-9]{6})$/i);
            if (test === null) return false;

            return {
              space: 'HEX',
              hex: parseInt('0x' + test[1].toString())
            };

          },

          write: toString

        },

        CSS_RGB: {

          read: function(original) {

            var test = original.match(/^rgb\(\s*(.+)\s*,\s*(.+)\s*,\s*(.+)\s*\)/);
            if (test === null) return false;

            return {
              space: 'RGB',
              r: parseFloat(test[1]),
              g: parseFloat(test[2]),
              b: parseFloat(test[3])
            };

          },

          write: toString

        },

        CSS_RGBA: {

          read: function(original) {

            var test = original.match(/^rgba\(\s*(.+)\s*,\s*(.+)\s*,\s*(.+)\s*\,\s*(.+)\s*\)/);
            if (test === null) return false;

            return {
              space: 'RGB',
              r: parseFloat(test[1]),
              g: parseFloat(test[2]),
              b: parseFloat(test[3]),
              a: parseFloat(test[4])
            };

          },

          write: toString

        }

      }

    },

    // Numbers
    {

      litmus: common.isNumber,

      conversions: {

        HEX: {
          read: function(original) {
            return {
              space: 'HEX',
              hex: original,
              conversionName: 'HEX'
            }
          },

          write: function(color) {
            return color.hex;
          }
        }

      }

    },

    // Arrays
    {

      litmus: common.isArray,

      conversions: {

        RGB_ARRAY: {
          read: function(original) {
            if (original.length != 3) return false;
            return {
              space: 'RGB',
              r: original[0],
              g: original[1],
              b: original[2]
            };
          },

          write: function(color) {
            return [color.r, color.g, color.b];
          }

        },

        RGBA_ARRAY: {
          read: function(original) {
            if (original.length != 4) return false;
            return {
              space: 'RGB',
              r: original[0],
              g: original[1],
              b: original[2],
              a: original[3]
            };
          },

          write: function(color) {
            return [color.r, color.g, color.b, color.a];
          }

        }

      }

    },

    // Objects
    {

      litmus: common.isObject,

      conversions: {

        RGBA_OBJ: {
          read: function(original) {
            if (common.isNumber(original.r) &&
                common.isNumber(original.g) &&
                common.isNumber(original.b) &&
                common.isNumber(original.a)) {
              return {
                space: 'RGB',
                r: original.r,
                g: original.g,
                b: original.b,
                a: original.a
              }
            }
            return false;
          },

          write: function(color) {
            return {
              r: color.r,
              g: color.g,
              b: color.b,
              a: color.a
            }
          }
        },

        RGB_OBJ: {
          read: function(original) {
            if (common.isNumber(original.r) &&
                common.isNumber(original.g) &&
                common.isNumber(original.b)) {
              return {
                space: 'RGB',
                r: original.r,
                g: original.g,
                b: original.b
              }
            }
            return false;
          },

          write: function(color) {
            return {
              r: color.r,
              g: color.g,
              b: color.b
            }
          }
        },

        HSVA_OBJ: {
          read: function(original) {
            if (common.isNumber(original.h) &&
                common.isNumber(original.s) &&
                common.isNumber(original.v) &&
                common.isNumber(original.a)) {
              return {
                space: 'HSV',
                h: original.h,
                s: original.s,
                v: original.v,
                a: original.a
              }
            }
            return false;
          },

          write: function(color) {
            return {
              h: color.h,
              s: color.s,
              v: color.v,
              a: color.a
            }
          }
        },

        HSV_OBJ: {
          read: function(original) {
            if (common.isNumber(original.h) &&
                common.isNumber(original.s) &&
                common.isNumber(original.v)) {
              return {
                space: 'HSV',
                h: original.h,
                s: original.s,
                v: original.v
              }
            }
            return false;
          },

          write: function(color) {
            return {
              h: color.h,
              s: color.s,
              v: color.v
            }
          }

        }

      }

    }


  ];

  return interpret;


})(dat.color.toString,
dat.utils.common),
dat.color.math = (function () {

  var tmpComponent;

  return {

    hsv_to_rgb: function(h, s, v) {

      var hi = Math.floor(h / 60) % 6;

      var f = h / 60 - Math.floor(h / 60);
      var p = v * (1.0 - s);
      var q = v * (1.0 - (f * s));
      var t = v * (1.0 - ((1.0 - f) * s));
      var c = [
        [v, t, p],
        [q, v, p],
        [p, v, t],
        [p, q, v],
        [t, p, v],
        [v, p, q]
      ][hi];

      return {
        r: c[0] * 255,
        g: c[1] * 255,
        b: c[2] * 255
      };

    },

    rgb_to_hsv: function(r, g, b) {

      var min = Math.min(r, g, b),
          max = Math.max(r, g, b),
          delta = max - min,
          h, s;

      if (max != 0) {
        s = delta / max;
      } else {
        return {
          h: NaN,
          s: 0,
          v: 0
        };
      }

      if (r == max) {
        h = (g - b) / delta;
      } else if (g == max) {
        h = 2 + (b - r) / delta;
      } else {
        h = 4 + (r - g) / delta;
      }
      h /= 6;
      if (h < 0) {
        h += 1;
      }

      return {
        h: h * 360,
        s: s,
        v: max / 255
      };
    },

    rgb_to_hex: function(r, g, b) {
      var hex = this.hex_with_component(0, 2, r);
      hex = this.hex_with_component(hex, 1, g);
      hex = this.hex_with_component(hex, 0, b);
      return hex;
    },

    component_from_hex: function(hex, componentIndex) {
      return (hex >> (componentIndex * 8)) & 0xFF;
    },

    hex_with_component: function(hex, componentIndex, value) {
      return value << (tmpComponent = componentIndex * 8) | (hex & ~ (0xFF << tmpComponent));
    }

  }

})(),
dat.color.toString,
dat.utils.common);
},{}],4:[function(require,module,exports){
/**
 * dat-gui JavaScript Controller Library
 * http://code.google.com/p/dat-gui
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/** @namespace */
var dat = module.exports = dat || {};

/** @namespace */
dat.gui = dat.gui || {};

/** @namespace */
dat.utils = dat.utils || {};

/** @namespace */
dat.controllers = dat.controllers || {};

/** @namespace */
dat.dom = dat.dom || {};

/** @namespace */
dat.color = dat.color || {};

dat.utils.css = (function () {
  return {
    load: function (url, doc) {
      doc = doc || document;
      var link = doc.createElement('link');
      link.type = 'text/css';
      link.rel = 'stylesheet';
      link.href = url;
      doc.getElementsByTagName('head')[0].appendChild(link);
    },
    inject: function(css, doc) {
      doc = doc || document;
      var injected = document.createElement('style');
      injected.type = 'text/css';
      injected.innerHTML = css;
      doc.getElementsByTagName('head')[0].appendChild(injected);
    }
  }
})();


dat.utils.common = (function () {
  
  var ARR_EACH = Array.prototype.forEach;
  var ARR_SLICE = Array.prototype.slice;

  /**
   * Band-aid methods for things that should be a lot easier in JavaScript.
   * Implementation and structure inspired by underscore.js
   * http://documentcloud.github.com/underscore/
   */

  return { 
    
    BREAK: {},
  
    extend: function(target) {
      
      this.each(ARR_SLICE.call(arguments, 1), function(obj) {
        
        for (var key in obj)
          if (!this.isUndefined(obj[key])) 
            target[key] = obj[key];
        
      }, this);
      
      return target;
      
    },
    
    defaults: function(target) {
      
      this.each(ARR_SLICE.call(arguments, 1), function(obj) {
        
        for (var key in obj)
          if (this.isUndefined(target[key])) 
            target[key] = obj[key];
        
      }, this);
      
      return target;
    
    },
    
    compose: function() {
      var toCall = ARR_SLICE.call(arguments);
            return function() {
              var args = ARR_SLICE.call(arguments);
              for (var i = toCall.length -1; i >= 0; i--) {
                args = [toCall[i].apply(this, args)];
              }
              return args[0];
            }
    },
    
    each: function(obj, itr, scope) {

      
      if (ARR_EACH && obj.forEach === ARR_EACH) { 
        
        obj.forEach(itr, scope);
        
      } else if (obj.length === obj.length + 0) { // Is number but not NaN
        
        for (var key = 0, l = obj.length; key < l; key++)
          if (key in obj && itr.call(scope, obj[key], key) === this.BREAK) 
            return;
            
      } else {

        for (var key in obj) 
          if (itr.call(scope, obj[key], key) === this.BREAK)
            return;
            
      }
            
    },
    
    defer: function(fnc) {
      setTimeout(fnc, 0);
    },
    
    toArray: function(obj) {
      if (obj.toArray) return obj.toArray();
      return ARR_SLICE.call(obj);
    },

    isUndefined: function(obj) {
      return obj === undefined;
    },
    
    isNull: function(obj) {
      return obj === null;
    },
    
    isNaN: function(obj) {
      return obj !== obj;
    },
    
    isArray: Array.isArray || function(obj) {
      return obj.constructor === Array;
    },
    
    isObject: function(obj) {
      return obj === Object(obj);
    },
    
    isNumber: function(obj) {
      return obj === obj+0;
    },
    
    isString: function(obj) {
      return obj === obj+'';
    },
    
    isBoolean: function(obj) {
      return obj === false || obj === true;
    },
    
    isFunction: function(obj) {
      return Object.prototype.toString.call(obj) === '[object Function]';
    }
  
  };
    
})();


dat.controllers.Controller = (function (common) {

  /**
   * @class An "abstract" class that represents a given property of an object.
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   *
   * @member dat.controllers
   */
  var Controller = function(object, property) {

    this.initialValue = object[property];

    /**
     * Those who extend this class will put their DOM elements in here.
     * @type {DOMElement}
     */
    this.domElement = document.createElement('div');

    /**
     * The object to manipulate
     * @type {Object}
     */
    this.object = object;

    /**
     * The name of the property to manipulate
     * @type {String}
     */
    this.property = property;

    /**
     * The function to be called on change.
     * @type {Function}
     * @ignore
     */
    this.__onChange = undefined;

    /**
     * The function to be called on finishing change.
     * @type {Function}
     * @ignore
     */
    this.__onFinishChange = undefined;

  };

  common.extend(

      Controller.prototype,

      /** @lends dat.controllers.Controller.prototype */
      {

        /**
         * Specify that a function fire every time someone changes the value with
         * this Controller.
         *
         * @param {Function} fnc This function will be called whenever the value
         * is modified via this Controller.
         * @returns {dat.controllers.Controller} this
         */
        onChange: function(fnc) {
          this.__onChange = fnc;
          return this;
        },

        /**
         * Specify that a function fire every time someone "finishes" changing
         * the value wih this Controller. Useful for values that change
         * incrementally like numbers or strings.
         *
         * @param {Function} fnc This function will be called whenever
         * someone "finishes" changing the value via this Controller.
         * @returns {dat.controllers.Controller} this
         */
        onFinishChange: function(fnc) {
          this.__onFinishChange = fnc;
          return this;
        },

        /**
         * Change the value of <code>object[property]</code>
         *
         * @param {Object} newValue The new value of <code>object[property]</code>
         */
        setValue: function(newValue) {
          this.object[this.property] = newValue;
          if (this.__onChange) {
            this.__onChange.call(this, newValue);
          }
          this.updateDisplay();
          return this;
        },

        /**
         * Gets the value of <code>object[property]</code>
         *
         * @returns {Object} The current value of <code>object[property]</code>
         */
        getValue: function() {
          return this.object[this.property];
        },

        /**
         * Refreshes the visual display of a Controller in order to keep sync
         * with the object's current value.
         * @returns {dat.controllers.Controller} this
         */
        updateDisplay: function() {
          return this;
        },

        /**
         * @returns {Boolean} true if the value has deviated from initialValue
         */
        isModified: function() {
          return this.initialValue !== this.getValue()
        }

      }

  );

  return Controller;


})(dat.utils.common);


dat.dom.dom = (function (common) {

  var EVENT_MAP = {
    'HTMLEvents': ['change'],
    'MouseEvents': ['click','mousemove','mousedown','mouseup', 'mouseover'],
    'KeyboardEvents': ['keydown']
  };

  var EVENT_MAP_INV = {};
  common.each(EVENT_MAP, function(v, k) {
    common.each(v, function(e) {
      EVENT_MAP_INV[e] = k;
    });
  });

  var CSS_VALUE_PIXELS = /(\d+(\.\d+)?)px/;

  function cssValueToPixels(val) {

    if (val === '0' || common.isUndefined(val)) return 0;

    var match = val.match(CSS_VALUE_PIXELS);

    if (!common.isNull(match)) {
      return parseFloat(match[1]);
    }

    // TODO ...ems? %?

    return 0;

  }

  /**
   * @namespace
   * @member dat.dom
   */
  var dom = {

    /**
     * 
     * @param elem
     * @param selectable
     */
    makeSelectable: function(elem, selectable) {

      if (elem === undefined || elem.style === undefined) return;

      elem.onselectstart = selectable ? function() {
        return false;
      } : function() {
      };

      elem.style.MozUserSelect = selectable ? 'auto' : 'none';
      elem.style.KhtmlUserSelect = selectable ? 'auto' : 'none';
      elem.unselectable = selectable ? 'on' : 'off';

    },

    /**
     *
     * @param elem
     * @param horizontal
     * @param vertical
     */
    makeFullscreen: function(elem, horizontal, vertical) {

      if (common.isUndefined(horizontal)) horizontal = true;
      if (common.isUndefined(vertical)) vertical = true;

      elem.style.position = 'absolute';

      if (horizontal) {
        elem.style.left = 0;
        elem.style.right = 0;
      }
      if (vertical) {
        elem.style.top = 0;
        elem.style.bottom = 0;
      }

    },

    /**
     *
     * @param elem
     * @param eventType
     * @param params
     */
    fakeEvent: function(elem, eventType, params, aux) {
      params = params || {};
      var className = EVENT_MAP_INV[eventType];
      if (!className) {
        throw new Error('Event type ' + eventType + ' not supported.');
      }
      var evt = document.createEvent(className);
      switch (className) {
        case 'MouseEvents':
          var clientX = params.x || params.clientX || 0;
          var clientY = params.y || params.clientY || 0;
          evt.initMouseEvent(eventType, params.bubbles || false,
              params.cancelable || true, window, params.clickCount || 1,
              0, //screen X
              0, //screen Y
              clientX, //client X
              clientY, //client Y
              false, false, false, false, 0, null);
          break;
        case 'KeyboardEvents':
          var init = evt.initKeyboardEvent || evt.initKeyEvent; // webkit || moz
          common.defaults(params, {
            cancelable: true,
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            metaKey: false,
            keyCode: undefined,
            charCode: undefined
          });
          init(eventType, params.bubbles || false,
              params.cancelable, window,
              params.ctrlKey, params.altKey,
              params.shiftKey, params.metaKey,
              params.keyCode, params.charCode);
          break;
        default:
          evt.initEvent(eventType, params.bubbles || false,
              params.cancelable || true);
          break;
      }
      common.defaults(evt, aux);
      elem.dispatchEvent(evt);
    },

    /**
     *
     * @param elem
     * @param event
     * @param func
     * @param bool
     */
    bind: function(elem, event, func, bool) {
      bool = bool || false;
      if (elem.addEventListener)
        elem.addEventListener(event, func, bool);
      else if (elem.attachEvent)
        elem.attachEvent('on' + event, func);
      return dom;
    },

    /**
     *
     * @param elem
     * @param event
     * @param func
     * @param bool
     */
    unbind: function(elem, event, func, bool) {
      bool = bool || false;
      if (elem.removeEventListener)
        elem.removeEventListener(event, func, bool);
      else if (elem.detachEvent)
        elem.detachEvent('on' + event, func);
      return dom;
    },

    /**
     *
     * @param elem
     * @param className
     */
    addClass: function(elem, className) {
      if (elem.className === undefined) {
        elem.className = className;
      } else if (elem.className !== className) {
        var classes = elem.className.split(/ +/);
        if (classes.indexOf(className) == -1) {
          classes.push(className);
          elem.className = classes.join(' ').replace(/^\s+/, '').replace(/\s+$/, '');
        }
      }
      return dom;
    },

    /**
     *
     * @param elem
     * @param className
     */
    removeClass: function(elem, className) {
      if (className) {
        if (elem.className === undefined) {
          // elem.className = className;
        } else if (elem.className === className) {
          elem.removeAttribute('class');
        } else {
          var classes = elem.className.split(/ +/);
          var index = classes.indexOf(className);
          if (index != -1) {
            classes.splice(index, 1);
            elem.className = classes.join(' ');
          }
        }
      } else {
        elem.className = undefined;
      }
      return dom;
    },

    hasClass: function(elem, className) {
      return new RegExp('(?:^|\\s+)' + className + '(?:\\s+|$)').test(elem.className) || false;
    },

    /**
     *
     * @param elem
     */
    getWidth: function(elem) {

      var style = getComputedStyle(elem);

      return cssValueToPixels(style['border-left-width']) +
          cssValueToPixels(style['border-right-width']) +
          cssValueToPixels(style['padding-left']) +
          cssValueToPixels(style['padding-right']) +
          cssValueToPixels(style['width']);
    },

    /**
     *
     * @param elem
     */
    getHeight: function(elem) {

      var style = getComputedStyle(elem);

      return cssValueToPixels(style['border-top-width']) +
          cssValueToPixels(style['border-bottom-width']) +
          cssValueToPixels(style['padding-top']) +
          cssValueToPixels(style['padding-bottom']) +
          cssValueToPixels(style['height']);
    },

    /**
     *
     * @param elem
     */
    getOffset: function(elem) {
      var offset = {left: 0, top:0};
      if (elem.offsetParent) {
        do {
          offset.left += elem.offsetLeft;
          offset.top += elem.offsetTop;
        } while (elem = elem.offsetParent);
      }
      return offset;
    },

    // http://stackoverflow.com/posts/2684561/revisions
    /**
     * 
     * @param elem
     */
    isActive: function(elem) {
      return elem === document.activeElement && ( elem.type || elem.href );
    }

  };

  return dom;

})(dat.utils.common);


dat.controllers.OptionController = (function (Controller, dom, common) {

  /**
   * @class Provides a select input to alter the property of an object, using a
   * list of accepted values.
   *
   * @extends dat.controllers.Controller
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   * @param {Object|string[]} options A map of labels to acceptable values, or
   * a list of acceptable string values.
   *
   * @member dat.controllers
   */
  var OptionController = function(object, property, options) {

    OptionController.superclass.call(this, object, property);

    var _this = this;

    /**
     * The drop down menu
     * @ignore
     */
    this.__select = document.createElement('select');

    if (common.isArray(options)) {
      var map = {};
      common.each(options, function(element) {
        map[element] = element;
      });
      options = map;
    }

    common.each(options, function(value, key) {

      var opt = document.createElement('option');
      opt.innerHTML = key;
      opt.setAttribute('value', value);
      _this.__select.appendChild(opt);

    });

    // Acknowledge original value
    this.updateDisplay();

    dom.bind(this.__select, 'change', function() {
      var desiredValue = this.options[this.selectedIndex].value;
      _this.setValue(desiredValue);
    });

    this.domElement.appendChild(this.__select);

  };

  OptionController.superclass = Controller;

  common.extend(

      OptionController.prototype,
      Controller.prototype,

      {

        setValue: function(v) {
          var toReturn = OptionController.superclass.prototype.setValue.call(this, v);
          if (this.__onFinishChange) {
            this.__onFinishChange.call(this, this.getValue());
          }
          return toReturn;
        },

        updateDisplay: function() {
          this.__select.value = this.getValue();
          return OptionController.superclass.prototype.updateDisplay.call(this);
        }

      }

  );

  return OptionController;

})(dat.controllers.Controller,
dat.dom.dom,
dat.utils.common);


dat.controllers.NumberController = (function (Controller, common) {

  /**
   * @class Represents a given property of an object that is a number.
   *
   * @extends dat.controllers.Controller
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   * @param {Object} [params] Optional parameters
   * @param {Number} [params.min] Minimum allowed value
   * @param {Number} [params.max] Maximum allowed value
   * @param {Number} [params.step] Increment by which to change value
   *
   * @member dat.controllers
   */
  var NumberController = function(object, property, params) {

    NumberController.superclass.call(this, object, property);

    params = params || {};

    this.__min = params.min;
    this.__max = params.max;
    this.__step = params.step;

    if (common.isUndefined(this.__step)) {

      if (this.initialValue == 0) {
        this.__impliedStep = 1; // What are we, psychics?
      } else {
        // Hey Doug, check this out.
        this.__impliedStep = Math.pow(10, Math.floor(Math.log(this.initialValue)/Math.LN10))/10;
      }

    } else {

      this.__impliedStep = this.__step;

    }

    this.__precision = numDecimals(this.__impliedStep);


  };

  NumberController.superclass = Controller;

  common.extend(

      NumberController.prototype,
      Controller.prototype,

      /** @lends dat.controllers.NumberController.prototype */
      {

        setValue: function(v) {

          if (this.__min !== undefined && v < this.__min) {
            v = this.__min;
          } else if (this.__max !== undefined && v > this.__max) {
            v = this.__max;
          }

          if (this.__step !== undefined && v % this.__step != 0) {
            v = Math.round(v / this.__step) * this.__step;
          }

          return NumberController.superclass.prototype.setValue.call(this, v);

        },

        /**
         * Specify a minimum value for <code>object[property]</code>.
         *
         * @param {Number} minValue The minimum value for
         * <code>object[property]</code>
         * @returns {dat.controllers.NumberController} this
         */
        min: function(v) {
          this.__min = v;
          return this;
        },

        /**
         * Specify a maximum value for <code>object[property]</code>.
         *
         * @param {Number} maxValue The maximum value for
         * <code>object[property]</code>
         * @returns {dat.controllers.NumberController} this
         */
        max: function(v) {
          this.__max = v;
          return this;
        },

        /**
         * Specify a step value that dat.controllers.NumberController
         * increments by.
         *
         * @param {Number} stepValue The step value for
         * dat.controllers.NumberController
         * @default if minimum and maximum specified increment is 1% of the
         * difference otherwise stepValue is 1
         * @returns {dat.controllers.NumberController} this
         */
        step: function(v) {
          this.__step = v;
          return this;
        }

      }

  );

  function numDecimals(x) {
    x = x.toString();
    if (x.indexOf('.') > -1) {
      return x.length - x.indexOf('.') - 1;
    } else {
      return 0;
    }
  }

  return NumberController;

})(dat.controllers.Controller,
dat.utils.common);


dat.controllers.NumberControllerBox = (function (NumberController, dom, common) {

  /**
   * @class Represents a given property of an object that is a number and
   * provides an input element with which to manipulate it.
   *
   * @extends dat.controllers.Controller
   * @extends dat.controllers.NumberController
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   * @param {Object} [params] Optional parameters
   * @param {Number} [params.min] Minimum allowed value
   * @param {Number} [params.max] Maximum allowed value
   * @param {Number} [params.step] Increment by which to change value
   *
   * @member dat.controllers
   */
  var NumberControllerBox = function(object, property, params) {

    this.__truncationSuspended = false;

    NumberControllerBox.superclass.call(this, object, property, params);

    var _this = this;

    /**
     * {Number} Previous mouse y position
     * @ignore
     */
    var prev_y;

    this.__input = document.createElement('input');
    this.__input.setAttribute('type', 'text');

    // Makes it so manually specified values are not truncated.

    dom.bind(this.__input, 'change', onChange);
    dom.bind(this.__input, 'blur', onBlur);
    dom.bind(this.__input, 'mousedown', onMouseDown);
    dom.bind(this.__input, 'keydown', function(e) {

      // When pressing entire, you can be as precise as you want.
      if (e.keyCode === 13) {
        _this.__truncationSuspended = true;
        this.blur();
        _this.__truncationSuspended = false;
      }

    });

    function onChange() {
      var attempted = parseFloat(_this.__input.value);
      if (!common.isNaN(attempted)) _this.setValue(attempted);
    }

    function onBlur() {
      onChange();
      if (_this.__onFinishChange) {
        _this.__onFinishChange.call(_this, _this.getValue());
      }
    }

    function onMouseDown(e) {
      dom.bind(window, 'mousemove', onMouseDrag);
      dom.bind(window, 'mouseup', onMouseUp);
      prev_y = e.clientY;
    }

    function onMouseDrag(e) {

      var diff = prev_y - e.clientY;
      _this.setValue(_this.getValue() + diff * _this.__impliedStep);

      prev_y = e.clientY;

    }

    function onMouseUp() {
      dom.unbind(window, 'mousemove', onMouseDrag);
      dom.unbind(window, 'mouseup', onMouseUp);
    }

    this.updateDisplay();

    this.domElement.appendChild(this.__input);

  };

  NumberControllerBox.superclass = NumberController;

  common.extend(

      NumberControllerBox.prototype,
      NumberController.prototype,

      {

        updateDisplay: function() {

          this.__input.value = this.__truncationSuspended ? this.getValue() : roundToDecimal(this.getValue(), this.__precision);
          return NumberControllerBox.superclass.prototype.updateDisplay.call(this);
        }

      }

  );

  function roundToDecimal(value, decimals) {
    var tenTo = Math.pow(10, decimals);
    return Math.round(value * tenTo) / tenTo;
  }

  return NumberControllerBox;

})(dat.controllers.NumberController,
dat.dom.dom,
dat.utils.common);


dat.controllers.NumberControllerSlider = (function (NumberController, dom, css, common, styleSheet) {

  /**
   * @class Represents a given property of an object that is a number, contains
   * a minimum and maximum, and provides a slider element with which to
   * manipulate it. It should be noted that the slider element is made up of
   * <code>&lt;div&gt;</code> tags, <strong>not</strong> the html5
   * <code>&lt;slider&gt;</code> element.
   *
   * @extends dat.controllers.Controller
   * @extends dat.controllers.NumberController
   * 
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   * @param {Number} minValue Minimum allowed value
   * @param {Number} maxValue Maximum allowed value
   * @param {Number} stepValue Increment by which to change value
   *
   * @member dat.controllers
   */
  var NumberControllerSlider = function(object, property, min, max, step) {

    NumberControllerSlider.superclass.call(this, object, property, { min: min, max: max, step: step });

    var _this = this;

    this.__background = document.createElement('div');
    this.__foreground = document.createElement('div');
    


    dom.bind(this.__background, 'mousedown', onMouseDown);
    
    dom.addClass(this.__background, 'slider');
    dom.addClass(this.__foreground, 'slider-fg');

    function onMouseDown(e) {

      dom.bind(window, 'mousemove', onMouseDrag);
      dom.bind(window, 'mouseup', onMouseUp);

      onMouseDrag(e);
    }

    function onMouseDrag(e) {

      e.preventDefault();

      var offset = dom.getOffset(_this.__background);
      var width = dom.getWidth(_this.__background);
      
      _this.setValue(
        map(e.clientX, offset.left, offset.left + width, _this.__min, _this.__max)
      );

      return false;

    }

    function onMouseUp() {
      dom.unbind(window, 'mousemove', onMouseDrag);
      dom.unbind(window, 'mouseup', onMouseUp);
      if (_this.__onFinishChange) {
        _this.__onFinishChange.call(_this, _this.getValue());
      }
    }

    this.updateDisplay();

    this.__background.appendChild(this.__foreground);
    this.domElement.appendChild(this.__background);

  };

  NumberControllerSlider.superclass = NumberController;

  /**
   * Injects default stylesheet for slider elements.
   */
  NumberControllerSlider.useDefaultStyles = function() {
    css.inject(styleSheet);
  };

  common.extend(

      NumberControllerSlider.prototype,
      NumberController.prototype,

      {

        updateDisplay: function() {
          var pct = (this.getValue() - this.__min)/(this.__max - this.__min);
          this.__foreground.style.width = pct*100+'%';
          return NumberControllerSlider.superclass.prototype.updateDisplay.call(this);
        }

      }



  );

  function map(v, i1, i2, o1, o2) {
    return o1 + (o2 - o1) * ((v - i1) / (i2 - i1));
  }

  return NumberControllerSlider;
  
})(dat.controllers.NumberController,
dat.dom.dom,
dat.utils.css,
dat.utils.common,
".slider {\n  box-shadow: inset 0 2px 4px rgba(0,0,0,0.15);\n  height: 1em;\n  border-radius: 1em;\n  background-color: #eee;\n  padding: 0 0.5em;\n  overflow: hidden;\n}\n\n.slider-fg {\n  padding: 1px 0 2px 0;\n  background-color: #aaa;\n  height: 1em;\n  margin-left: -0.5em;\n  padding-right: 0.5em;\n  border-radius: 1em 0 0 1em;\n}\n\n.slider-fg:after {\n  display: inline-block;\n  border-radius: 1em;\n  background-color: #fff;\n  border:  1px solid #aaa;\n  content: '';\n  float: right;\n  margin-right: -1em;\n  margin-top: -1px;\n  height: 0.9em;\n  width: 0.9em;\n}");


dat.controllers.FunctionController = (function (Controller, dom, common) {

  /**
   * @class Provides a GUI interface to fire a specified method, a property of an object.
   *
   * @extends dat.controllers.Controller
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   *
   * @member dat.controllers
   */
  var FunctionController = function(object, property, text) {

    FunctionController.superclass.call(this, object, property);

    var _this = this;

    this.__button = document.createElement('div');
    this.__button.innerHTML = text === undefined ? 'Fire' : text;
    dom.bind(this.__button, 'click', function(e) {
      e.preventDefault();
      _this.fire();
      return false;
    });

    dom.addClass(this.__button, 'button');

    this.domElement.appendChild(this.__button);


  };

  FunctionController.superclass = Controller;

  common.extend(

      FunctionController.prototype,
      Controller.prototype,
      {
        
        fire: function() {
          if (this.__onChange) {
            this.__onChange.call(this);
          }
          if (this.__onFinishChange) {
            this.__onFinishChange.call(this, this.getValue());
          }
          this.getValue().call(this.object);
        }
      }

  );

  return FunctionController;

})(dat.controllers.Controller,
dat.dom.dom,
dat.utils.common);


dat.controllers.BooleanController = (function (Controller, dom, common) {

  /**
   * @class Provides a checkbox input to alter the boolean property of an object.
   * @extends dat.controllers.Controller
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   *
   * @member dat.controllers
   */
  var BooleanController = function(object, property) {

    BooleanController.superclass.call(this, object, property);

    var _this = this;
    this.__prev = this.getValue();

    this.__checkbox = document.createElement('input');
    this.__checkbox.setAttribute('type', 'checkbox');


    dom.bind(this.__checkbox, 'change', onChange, false);

    this.domElement.appendChild(this.__checkbox);

    // Match original value
    this.updateDisplay();

    function onChange() {
      _this.setValue(!_this.__prev);
    }

  };

  BooleanController.superclass = Controller;

  common.extend(

      BooleanController.prototype,
      Controller.prototype,

      {

        setValue: function(v) {
          var toReturn = BooleanController.superclass.prototype.setValue.call(this, v);
          if (this.__onFinishChange) {
            this.__onFinishChange.call(this, this.getValue());
          }
          this.__prev = this.getValue();
          return toReturn;
        },

        updateDisplay: function() {
          
          if (this.getValue() === true) {
            this.__checkbox.setAttribute('checked', 'checked');
            this.__checkbox.checked = true;    
          } else {
              this.__checkbox.checked = false;
          }

          return BooleanController.superclass.prototype.updateDisplay.call(this);

        }


      }

  );

  return BooleanController;

})(dat.controllers.Controller,
dat.dom.dom,
dat.utils.common);


dat.color.toString = (function (common) {

  return function(color) {

    if (color.a == 1 || common.isUndefined(color.a)) {

      var s = color.hex.toString(16);
      while (s.length < 6) {
        s = '0' + s;
      }

      return '#' + s;

    } else {

      return 'rgba(' + Math.round(color.r) + ',' + Math.round(color.g) + ',' + Math.round(color.b) + ',' + color.a + ')';

    }

  }

})(dat.utils.common);


dat.color.interpret = (function (toString, common) {

  var result, toReturn;

  var interpret = function() {

    toReturn = false;

    var original = arguments.length > 1 ? common.toArray(arguments) : arguments[0];

    common.each(INTERPRETATIONS, function(family) {

      if (family.litmus(original)) {

        common.each(family.conversions, function(conversion, conversionName) {

          result = conversion.read(original);

          if (toReturn === false && result !== false) {
            toReturn = result;
            result.conversionName = conversionName;
            result.conversion = conversion;
            return common.BREAK;

          }

        });

        return common.BREAK;

      }

    });

    return toReturn;

  };

  var INTERPRETATIONS = [

    // Strings
    {

      litmus: common.isString,

      conversions: {

        THREE_CHAR_HEX: {

          read: function(original) {

            var test = original.match(/^#([A-F0-9])([A-F0-9])([A-F0-9])$/i);
            if (test === null) return false;

            return {
              space: 'HEX',
              hex: parseInt(
                  '0x' +
                      test[1].toString() + test[1].toString() +
                      test[2].toString() + test[2].toString() +
                      test[3].toString() + test[3].toString())
            };

          },

          write: toString

        },

        SIX_CHAR_HEX: {

          read: function(original) {

            var test = original.match(/^#([A-F0-9]{6})$/i);
            if (test === null) return false;

            return {
              space: 'HEX',
              hex: parseInt('0x' + test[1].toString())
            };

          },

          write: toString

        },

        CSS_RGB: {

          read: function(original) {

            var test = original.match(/^rgb\(\s*(.+)\s*,\s*(.+)\s*,\s*(.+)\s*\)/);
            if (test === null) return false;

            return {
              space: 'RGB',
              r: parseFloat(test[1]),
              g: parseFloat(test[2]),
              b: parseFloat(test[3])
            };

          },

          write: toString

        },

        CSS_RGBA: {

          read: function(original) {

            var test = original.match(/^rgba\(\s*(.+)\s*,\s*(.+)\s*,\s*(.+)\s*\,\s*(.+)\s*\)/);
            if (test === null) return false;

            return {
              space: 'RGB',
              r: parseFloat(test[1]),
              g: parseFloat(test[2]),
              b: parseFloat(test[3]),
              a: parseFloat(test[4])
            };

          },

          write: toString

        }

      }

    },

    // Numbers
    {

      litmus: common.isNumber,

      conversions: {

        HEX: {
          read: function(original) {
            return {
              space: 'HEX',
              hex: original,
              conversionName: 'HEX'
            }
          },

          write: function(color) {
            return color.hex;
          }
        }

      }

    },

    // Arrays
    {

      litmus: common.isArray,

      conversions: {

        RGB_ARRAY: {
          read: function(original) {
            if (original.length != 3) return false;
            return {
              space: 'RGB',
              r: original[0],
              g: original[1],
              b: original[2]
            };
          },

          write: function(color) {
            return [color.r, color.g, color.b];
          }

        },

        RGBA_ARRAY: {
          read: function(original) {
            if (original.length != 4) return false;
            return {
              space: 'RGB',
              r: original[0],
              g: original[1],
              b: original[2],
              a: original[3]
            };
          },

          write: function(color) {
            return [color.r, color.g, color.b, color.a];
          }

        }

      }

    },

    // Objects
    {

      litmus: common.isObject,

      conversions: {

        RGBA_OBJ: {
          read: function(original) {
            if (common.isNumber(original.r) &&
                common.isNumber(original.g) &&
                common.isNumber(original.b) &&
                common.isNumber(original.a)) {
              return {
                space: 'RGB',
                r: original.r,
                g: original.g,
                b: original.b,
                a: original.a
              }
            }
            return false;
          },

          write: function(color) {
            return {
              r: color.r,
              g: color.g,
              b: color.b,
              a: color.a
            }
          }
        },

        RGB_OBJ: {
          read: function(original) {
            if (common.isNumber(original.r) &&
                common.isNumber(original.g) &&
                common.isNumber(original.b)) {
              return {
                space: 'RGB',
                r: original.r,
                g: original.g,
                b: original.b
              }
            }
            return false;
          },

          write: function(color) {
            return {
              r: color.r,
              g: color.g,
              b: color.b
            }
          }
        },

        HSVA_OBJ: {
          read: function(original) {
            if (common.isNumber(original.h) &&
                common.isNumber(original.s) &&
                common.isNumber(original.v) &&
                common.isNumber(original.a)) {
              return {
                space: 'HSV',
                h: original.h,
                s: original.s,
                v: original.v,
                a: original.a
              }
            }
            return false;
          },

          write: function(color) {
            return {
              h: color.h,
              s: color.s,
              v: color.v,
              a: color.a
            }
          }
        },

        HSV_OBJ: {
          read: function(original) {
            if (common.isNumber(original.h) &&
                common.isNumber(original.s) &&
                common.isNumber(original.v)) {
              return {
                space: 'HSV',
                h: original.h,
                s: original.s,
                v: original.v
              }
            }
            return false;
          },

          write: function(color) {
            return {
              h: color.h,
              s: color.s,
              v: color.v
            }
          }

        }

      }

    }


  ];

  return interpret;


})(dat.color.toString,
dat.utils.common);


dat.GUI = dat.gui.GUI = (function (css, saveDialogueContents, styleSheet, controllerFactory, Controller, BooleanController, FunctionController, NumberControllerBox, NumberControllerSlider, OptionController, ColorController, requestAnimationFrame, CenteredDiv, dom, common) {

  css.inject(styleSheet);

  /** Outer-most className for GUI's */
  var CSS_NAMESPACE = 'dg';

  var HIDE_KEY_CODE = 72;

  /** The only value shared between the JS and SCSS. Use caution. */
  var CLOSE_BUTTON_HEIGHT = 20;

  var DEFAULT_DEFAULT_PRESET_NAME = 'Default';

  var SUPPORTS_LOCAL_STORAGE = (function() {
    try {
      return 'localStorage' in window && window['localStorage'] !== null;
    } catch (e) {
      return false;
    }
  })();

  var SAVE_DIALOGUE;

  /** Have we yet to create an autoPlace GUI? */
  var auto_place_virgin = true;

  /** Fixed position div that auto place GUI's go inside */
  var auto_place_container;

  /** Are we hiding the GUI's ? */
  var hide = false;

  /** GUI's which should be hidden */
  var hideable_guis = [];

  /**
   * A lightweight controller library for JavaScript. It allows you to easily
   * manipulate variables and fire functions on the fly.
   * @class
   *
   * @member dat.gui
   *
   * @param {Object} [params]
   * @param {String} [params.name] The name of this GUI.
   * @param {Object} [params.load] JSON object representing the saved state of
   * this GUI.
   * @param {Boolean} [params.auto=true]
   * @param {dat.gui.GUI} [params.parent] The GUI I'm nested in.
   * @param {Boolean} [params.closed] If true, starts closed
   */
  var GUI = function(params) {

    var _this = this;

    /**
     * Outermost DOM Element
     * @type DOMElement
     */
    this.domElement = document.createElement('div');
    this.__ul = document.createElement('ul');
    this.domElement.appendChild(this.__ul);

    dom.addClass(this.domElement, CSS_NAMESPACE);

    /**
     * Nested GUI's by name
     * @ignore
     */
    this.__folders = {};

    this.__controllers = [];

    /**
     * List of objects I'm remembering for save, only used in top level GUI
     * @ignore
     */
    this.__rememberedObjects = [];

    /**
     * Maps the index of remembered objects to a map of controllers, only used
     * in top level GUI.
     *
     * @private
     * @ignore
     *
     * @example
     * [
     *  {
     *    propertyName: Controller,
     *    anotherPropertyName: Controller
     *  },
     *  {
     *    propertyName: Controller
     *  }
     * ]
     */
    this.__rememberedObjectIndecesToControllers = [];

    this.__listening = [];

    params = params || {};

    // Default parameters
    params = common.defaults(params, {
      autoPlace: true,
      width: GUI.DEFAULT_WIDTH
    });

    params = common.defaults(params, {
      resizable: params.autoPlace,
      hideable: params.autoPlace
    });


    if (!common.isUndefined(params.load)) {

      // Explicit preset
      if (params.preset) params.load.preset = params.preset;

    } else {

      params.load = { preset: DEFAULT_DEFAULT_PRESET_NAME };

    }

    if (common.isUndefined(params.parent) && params.hideable) {
      hideable_guis.push(this);
    }

    // Only root level GUI's are resizable.
    params.resizable = common.isUndefined(params.parent) && params.resizable;


    if (params.autoPlace && common.isUndefined(params.scrollable)) {
      params.scrollable = true;
    }
//    params.scrollable = common.isUndefined(params.parent) && params.scrollable === true;

    // Not part of params because I don't want people passing this in via
    // constructor. Should be a 'remembered' value.
    var use_local_storage =
        SUPPORTS_LOCAL_STORAGE &&
            localStorage.getItem(getLocalStorageHash(this, 'isLocal')) === 'true';

    Object.defineProperties(this,

        /** @lends dat.gui.GUI.prototype */
        {

          /**
           * The parent <code>GUI</code>
           * @type dat.gui.GUI
           */
          parent: {
            get: function() {
              return params.parent;
            }
          },

          scrollable: {
            get: function() {
              return params.scrollable;
            }
          },

          /**
           * Handles <code>GUI</code>'s element placement for you
           * @type Boolean
           */
          autoPlace: {
            get: function() {
              return params.autoPlace;
            }
          },

          /**
           * The identifier for a set of saved values
           * @type String
           */
          preset: {

            get: function() {
              if (_this.parent) {
                return _this.getRoot().preset;
              } else {
                return params.load.preset;
              }
            },

            set: function(v) {
              if (_this.parent) {
                _this.getRoot().preset = v;
              } else {
                params.load.preset = v;
              }
              setPresetSelectIndex(this);
              _this.revert();
            }

          },

          /**
           * The width of <code>GUI</code> element
           * @type Number
           */
          width: {
            get: function() {
              return params.width;
            },
            set: function(v) {
              params.width = v;
              setWidth(_this, v);
            }
          },

          /**
           * The name of <code>GUI</code>. Used for folders. i.e
           * a folder's name
           * @type String
           */
          name: {
            get: function() {
              return params.name;
            },
            set: function(v) {
              // TODO Check for collisions among sibling folders
              params.name = v;
              if (title_row_name) {
                title_row_name.innerHTML = params.name;
              }
            }
          },

          /**
           * Whether the <code>GUI</code> is collapsed or not
           * @type Boolean
           */
          closed: {
            get: function() {
              return params.closed;
            },
            set: function(v) {
              params.closed = v;
              if (params.closed) {
                dom.addClass(_this.__ul, GUI.CLASS_CLOSED);
              } else {
                dom.removeClass(_this.__ul, GUI.CLASS_CLOSED);
              }
              // For browsers that aren't going to respect the CSS transition,
              // Lets just check our height against the window height right off
              // the bat.
              this.onResize();

              if (_this.__closeButton) {
                _this.__closeButton.innerHTML = v ? GUI.TEXT_OPEN : GUI.TEXT_CLOSED;
              }
            }
          },

          /**
           * Contains all presets
           * @type Object
           */
          load: {
            get: function() {
              return params.load;
            }
          },

          /**
           * Determines whether or not to use <a href="https://developer.mozilla.org/en/DOM/Storage#localStorage">localStorage</a> as the means for
           * <code>remember</code>ing
           * @type Boolean
           */
          useLocalStorage: {

            get: function() {
              return use_local_storage;
            },
            set: function(bool) {
              if (SUPPORTS_LOCAL_STORAGE) {
                use_local_storage = bool;
                if (bool) {
                  dom.bind(window, 'unload', saveToLocalStorage);
                } else {
                  dom.unbind(window, 'unload', saveToLocalStorage);
                }
                localStorage.setItem(getLocalStorageHash(_this, 'isLocal'), bool);
              }
            }

          }

        });

    // Are we a root level GUI?
    if (common.isUndefined(params.parent)) {

      params.closed = false;

      dom.addClass(this.domElement, GUI.CLASS_MAIN);
      dom.makeSelectable(this.domElement, false);

      // Are we supposed to be loading locally?
      if (SUPPORTS_LOCAL_STORAGE) {

        if (use_local_storage) {

          _this.useLocalStorage = true;

          var saved_gui = localStorage.getItem(getLocalStorageHash(this, 'gui'));

          if (saved_gui) {
            params.load = JSON.parse(saved_gui);
          }

        }

      }

      this.__closeButton = document.createElement('div');
      this.__closeButton.innerHTML = GUI.TEXT_CLOSED;
      dom.addClass(this.__closeButton, GUI.CLASS_CLOSE_BUTTON);
      this.domElement.appendChild(this.__closeButton);

      dom.bind(this.__closeButton, 'click', function() {

        _this.closed = !_this.closed;


      });


      // Oh, you're a nested GUI!
    } else {

      if (params.closed === undefined) {
        params.closed = true;
      }

      var title_row_name = document.createTextNode(params.name);
      dom.addClass(title_row_name, 'controller-name');

      var title_row = addRow(_this, title_row_name);

      var on_click_title = function(e) {
        e.preventDefault();
        _this.closed = !_this.closed;
        return false;
      };

      dom.addClass(this.__ul, GUI.CLASS_CLOSED);

      dom.addClass(title_row, 'title');
      dom.bind(title_row, 'click', on_click_title);

      if (!params.closed) {
        this.closed = false;
      }

    }

    if (params.autoPlace) {

      if (common.isUndefined(params.parent)) {

        if (auto_place_virgin) {
          auto_place_container = document.createElement('div');
          dom.addClass(auto_place_container, CSS_NAMESPACE);
          dom.addClass(auto_place_container, GUI.CLASS_AUTO_PLACE_CONTAINER);
          document.body.appendChild(auto_place_container);
          auto_place_virgin = false;
        }

        // Put it in the dom for you.
        auto_place_container.appendChild(this.domElement);

        // Apply the auto styles
        dom.addClass(this.domElement, GUI.CLASS_AUTO_PLACE);

      }


      // Make it not elastic.
      if (!this.parent) setWidth(_this, params.width);

    }

    dom.bind(window, 'resize', function() { _this.onResize() });
    dom.bind(this.__ul, 'webkitTransitionEnd', function() { _this.onResize(); });
    dom.bind(this.__ul, 'transitionend', function() { _this.onResize() });
    dom.bind(this.__ul, 'oTransitionEnd', function() { _this.onResize() });
    this.onResize();


    if (params.resizable) {
      addResizeHandle(this);
    }

    function saveToLocalStorage() {
      localStorage.setItem(getLocalStorageHash(_this, 'gui'), JSON.stringify(_this.getSaveObject()));
    }

    var root = _this.getRoot();
    function resetWidth() {
        var root = _this.getRoot();
        root.width += 1;
        common.defer(function() {
          root.width -= 1;
        });
      }

      if (!params.parent) {
        resetWidth();
      }

  };

  GUI.toggleHide = function() {

    hide = !hide;
    common.each(hideable_guis, function(gui) {
      gui.domElement.style.zIndex = hide ? -999 : 999;
      gui.domElement.style.opacity = hide ? 0 : 1;
    });
  };

  GUI.CLASS_AUTO_PLACE = 'a';
  GUI.CLASS_AUTO_PLACE_CONTAINER = 'ac';
  GUI.CLASS_MAIN = 'main';
  GUI.CLASS_CONTROLLER_ROW = 'cr';
  GUI.CLASS_TOO_TALL = 'taller-than-window';
  GUI.CLASS_CLOSED = 'closed';
  GUI.CLASS_CLOSE_BUTTON = 'close-button';
  GUI.CLASS_DRAG = 'drag';

  GUI.DEFAULT_WIDTH = 245;
  GUI.TEXT_CLOSED = 'Close Controls';
  GUI.TEXT_OPEN = 'Open Controls';

  dom.bind(window, 'keydown', function(e) {

    if (document.activeElement.type !== 'text' &&
        (e.which === HIDE_KEY_CODE || e.keyCode == HIDE_KEY_CODE)) {
      GUI.toggleHide();
    }

  }, false);

  common.extend(

      GUI.prototype,

      /** @lends dat.gui.GUI */
      {

        /**
         * @param object
         * @param property
         * @returns {dat.controllers.Controller} The new controller that was added.
         * @instance
         */
        add: function(object, property) {

          return add(
              this,
              object,
              property,
              {
                factoryArgs: Array.prototype.slice.call(arguments, 2)
              }
          );

        },

        /**
         * @param object
         * @param property
         * @returns {dat.controllers.ColorController} The new controller that was added.
         * @instance
         */
        addColor: function(object, property) {

          return add(
              this,
              object,
              property,
              {
                color: true
              }
          );

        },

        /**
         * @param controller
         * @instance
         */
        remove: function(controller) {

          // TODO listening?
          this.__ul.removeChild(controller.__li);
          this.__controllers.slice(this.__controllers.indexOf(controller), 1);
          var _this = this;
          common.defer(function() {
            _this.onResize();
          });

        },

        destroy: function() {

          if (this.autoPlace) {
            auto_place_container.removeChild(this.domElement);
          }

        },

        /**
         * @param name
         * @returns {dat.gui.GUI} The new folder.
         * @throws {Error} if this GUI already has a folder by the specified
         * name
         * @instance
         */
        addFolder: function(name) {

          // We have to prevent collisions on names in order to have a key
          // by which to remember saved values
          if (this.__folders[name] !== undefined) {
            throw new Error('You already have a folder in this GUI by the' +
                ' name "' + name + '"');
          }

          var new_gui_params = { name: name, parent: this };

          // We need to pass down the autoPlace trait so that we can
          // attach event listeners to open/close folder actions to
          // ensure that a scrollbar appears if the window is too short.
          new_gui_params.autoPlace = this.autoPlace;

          // Do we have saved appearance data for this folder?

          if (this.load && // Anything loaded?
              this.load.folders && // Was my parent a dead-end?
              this.load.folders[name]) { // Did daddy remember me?

            // Start me closed if I was closed
            new_gui_params.closed = this.load.folders[name].closed;

            // Pass down the loaded data
            new_gui_params.load = this.load.folders[name];

          }

          var gui = new GUI(new_gui_params);
          this.__folders[name] = gui;

          var li = addRow(this, gui.domElement);
          dom.addClass(li, 'folder');
          return gui;

        },

        open: function() {
          this.closed = false;
        },

        close: function() {
          this.closed = true;
        },

        onResize: function() {

          var root = this.getRoot();

          if (root.scrollable) {

            var top = dom.getOffset(root.__ul).top;
            var h = 0;

            common.each(root.__ul.childNodes, function(node) {
              if (! (root.autoPlace && node === root.__save_row))
                h += dom.getHeight(node);
            });

            if (window.innerHeight - top - CLOSE_BUTTON_HEIGHT < h) {
              dom.addClass(root.domElement, GUI.CLASS_TOO_TALL);
              root.__ul.style.height = window.innerHeight - top - CLOSE_BUTTON_HEIGHT + 'px';
            } else {
              dom.removeClass(root.domElement, GUI.CLASS_TOO_TALL);
              root.__ul.style.height = 'auto';
            }

          }

          if (root.__resize_handle) {
            common.defer(function() {
              root.__resize_handle.style.height = root.__ul.offsetHeight + 'px';
            });
          }

          if (root.__closeButton) {
            root.__closeButton.style.width = root.width + 'px';
          }

        },

        /**
         * Mark objects for saving. The order of these objects cannot change as
         * the GUI grows. When remembering new objects, append them to the end
         * of the list.
         *
         * @param {Object...} objects
         * @throws {Error} if not called on a top level GUI.
         * @instance
         */
        remember: function() {

          if (common.isUndefined(SAVE_DIALOGUE)) {
            SAVE_DIALOGUE = new CenteredDiv();
            SAVE_DIALOGUE.domElement.innerHTML = saveDialogueContents;
          }

          if (this.parent) {
            throw new Error("You can only call remember on a top level GUI.");
          }

          var _this = this;

          common.each(Array.prototype.slice.call(arguments), function(object) {
            if (_this.__rememberedObjects.length == 0) {
              addSaveMenu(_this);
            }
            if (_this.__rememberedObjects.indexOf(object) == -1) {
              _this.__rememberedObjects.push(object);
            }
          });

          if (this.autoPlace) {
            // Set save row width
            setWidth(this, this.width);
          }

        },

        /**
         * @returns {dat.gui.GUI} the topmost parent GUI of a nested GUI.
         * @instance
         */
        getRoot: function() {
          var gui = this;
          while (gui.parent) {
            gui = gui.parent;
          }
          return gui;
        },

        /**
         * @returns {Object} a JSON object representing the current state of
         * this GUI as well as its remembered properties.
         * @instance
         */
        getSaveObject: function() {

          var toReturn = this.load;

          toReturn.closed = this.closed;

          // Am I remembering any values?
          if (this.__rememberedObjects.length > 0) {

            toReturn.preset = this.preset;

            if (!toReturn.remembered) {
              toReturn.remembered = {};
            }

            toReturn.remembered[this.preset] = getCurrentPreset(this);

          }

          toReturn.folders = {};
          common.each(this.__folders, function(element, key) {
            toReturn.folders[key] = element.getSaveObject();
          });

          return toReturn;

        },

        save: function() {

          if (!this.load.remembered) {
            this.load.remembered = {};
          }

          this.load.remembered[this.preset] = getCurrentPreset(this);
          markPresetModified(this, false);

        },

        saveAs: function(presetName) {

          if (!this.load.remembered) {

            // Retain default values upon first save
            this.load.remembered = {};
            this.load.remembered[DEFAULT_DEFAULT_PRESET_NAME] = getCurrentPreset(this, true);

          }

          this.load.remembered[presetName] = getCurrentPreset(this);
          this.preset = presetName;
          addPresetOption(this, presetName, true);

        },

        revert: function(gui) {

          common.each(this.__controllers, function(controller) {
            // Make revert work on Default.
            if (!this.getRoot().load.remembered) {
              controller.setValue(controller.initialValue);
            } else {
              recallSavedValue(gui || this.getRoot(), controller);
            }
          }, this);

          common.each(this.__folders, function(folder) {
            folder.revert(folder);
          });

          if (!gui) {
            markPresetModified(this.getRoot(), false);
          }


        },

        listen: function(controller) {

          var init = this.__listening.length == 0;
          this.__listening.push(controller);
          if (init) updateDisplays(this.__listening);

        }

      }

  );

  function add(gui, object, property, params) {

    if (object[property] === undefined) {
      throw new Error("Object " + object + " has no property \"" + property + "\"");
    }

    var controller;

    if (params.color) {

      controller = new ColorController(object, property);

    } else {

      var factoryArgs = [object,property].concat(params.factoryArgs);
      controller = controllerFactory.apply(gui, factoryArgs);

    }

    if (params.before instanceof Controller) {
      params.before = params.before.__li;
    }

    recallSavedValue(gui, controller);

    dom.addClass(controller.domElement, 'c');

    var name = document.createElement('span');
    dom.addClass(name, 'property-name');
    name.innerHTML = controller.property;

    var container = document.createElement('div');
    container.appendChild(name);
    container.appendChild(controller.domElement);

    var li = addRow(gui, container, params.before);

    dom.addClass(li, GUI.CLASS_CONTROLLER_ROW);
    dom.addClass(li, typeof controller.getValue());

    augmentController(gui, li, controller);

    gui.__controllers.push(controller);

    return controller;

  }

  /**
   * Add a row to the end of the GUI or before another row.
   *
   * @param gui
   * @param [dom] If specified, inserts the dom content in the new row
   * @param [liBefore] If specified, places the new row before another row
   */
  function addRow(gui, dom, liBefore) {
    var li = document.createElement('li');
    if (dom) li.appendChild(dom);
    if (liBefore) {
      gui.__ul.insertBefore(li, params.before);
    } else {
      gui.__ul.appendChild(li);
    }
    gui.onResize();
    return li;
  }

  function augmentController(gui, li, controller) {

    controller.__li = li;
    controller.__gui = gui;

    common.extend(controller, {

      options: function(options) {

        if (arguments.length > 1) {
          controller.remove();

          return add(
              gui,
              controller.object,
              controller.property,
              {
                before: controller.__li.nextElementSibling,
                factoryArgs: [common.toArray(arguments)]
              }
          );

        }

        if (common.isArray(options) || common.isObject(options)) {
          controller.remove();

          return add(
              gui,
              controller.object,
              controller.property,
              {
                before: controller.__li.nextElementSibling,
                factoryArgs: [options]
              }
          );

        }

      },

      name: function(v) {
        controller.__li.firstElementChild.firstElementChild.innerHTML = v;
        return controller;
      },

      listen: function() {
        controller.__gui.listen(controller);
        return controller;
      },

      remove: function() {
        controller.__gui.remove(controller);
        return controller;
      }

    });

    // All sliders should be accompanied by a box.
    if (controller instanceof NumberControllerSlider) {

      var box = new NumberControllerBox(controller.object, controller.property,
          { min: controller.__min, max: controller.__max, step: controller.__step });

      common.each(['updateDisplay', 'onChange', 'onFinishChange'], function(method) {
        var pc = controller[method];
        var pb = box[method];
        controller[method] = box[method] = function() {
          var args = Array.prototype.slice.call(arguments);
          pc.apply(controller, args);
          return pb.apply(box, args);
        }
      });

      dom.addClass(li, 'has-slider');
      controller.domElement.insertBefore(box.domElement, controller.domElement.firstElementChild);

    }
    else if (controller instanceof NumberControllerBox) {

      var r = function(returned) {

        // Have we defined both boundaries?
        if (common.isNumber(controller.__min) && common.isNumber(controller.__max)) {

          // Well, then lets just replace this with a slider.
          controller.remove();
          return add(
              gui,
              controller.object,
              controller.property,
              {
                before: controller.__li.nextElementSibling,
                factoryArgs: [controller.__min, controller.__max, controller.__step]
              });

        }

        return returned;

      };

      controller.min = common.compose(r, controller.min);
      controller.max = common.compose(r, controller.max);

    }
    else if (controller instanceof BooleanController) {

      dom.bind(li, 'click', function() {
        dom.fakeEvent(controller.__checkbox, 'click');
      });

      dom.bind(controller.__checkbox, 'click', function(e) {
        e.stopPropagation(); // Prevents double-toggle
      })

    }
    else if (controller instanceof FunctionController) {

      dom.bind(li, 'click', function() {
        dom.fakeEvent(controller.__button, 'click');
      });

      dom.bind(li, 'mouseover', function() {
        dom.addClass(controller.__button, 'hover');
      });

      dom.bind(li, 'mouseout', function() {
        dom.removeClass(controller.__button, 'hover');
      });

    }
    else if (controller instanceof ColorController) {

      dom.addClass(li, 'color');
      controller.updateDisplay = common.compose(function(r) {
        li.style.borderLeftColor = controller.__color.toString();
        return r;
      }, controller.updateDisplay);

      controller.updateDisplay();

    }

    controller.setValue = common.compose(function(r) {
      if (gui.getRoot().__preset_select && controller.isModified()) {
        markPresetModified(gui.getRoot(), true);
      }
      return r;
    }, controller.setValue);

  }

  function recallSavedValue(gui, controller) {

    // Find the topmost GUI, that's where remembered objects live.
    var root = gui.getRoot();

    // Does the object we're controlling match anything we've been told to
    // remember?
    var matched_index = root.__rememberedObjects.indexOf(controller.object);

    // Why yes, it does!
    if (matched_index != -1) {

      // Let me fetch a map of controllers for thcommon.isObject.
      var controller_map =
          root.__rememberedObjectIndecesToControllers[matched_index];

      // Ohp, I believe this is the first controller we've created for this
      // object. Lets make the map fresh.
      if (controller_map === undefined) {
        controller_map = {};
        root.__rememberedObjectIndecesToControllers[matched_index] =
            controller_map;
      }

      // Keep track of this controller
      controller_map[controller.property] = controller;

      // Okay, now have we saved any values for this controller?
      if (root.load && root.load.remembered) {

        var preset_map = root.load.remembered;

        // Which preset are we trying to load?
        var preset;

        if (preset_map[gui.preset]) {

          preset = preset_map[gui.preset];

        } else if (preset_map[DEFAULT_DEFAULT_PRESET_NAME]) {

          // Uhh, you can have the default instead?
          preset = preset_map[DEFAULT_DEFAULT_PRESET_NAME];

        } else {

          // Nada.

          return;

        }


        // Did the loaded object remember thcommon.isObject?
        if (preset[matched_index] &&

          // Did we remember this particular property?
            preset[matched_index][controller.property] !== undefined) {

          // We did remember something for this guy ...
          var value = preset[matched_index][controller.property];

          // And that's what it is.
          controller.initialValue = value;
          controller.setValue(value);

        }

      }

    }

  }

  function getLocalStorageHash(gui, key) {
    // TODO how does this deal with multiple GUI's?
    return document.location.href + '.' + key;

  }

  function addSaveMenu(gui) {

    var div = gui.__save_row = document.createElement('li');

    dom.addClass(gui.domElement, 'has-save');

    gui.__ul.insertBefore(div, gui.__ul.firstChild);

    dom.addClass(div, 'save-row');

    var gears = document.createElement('span');
    gears.innerHTML = '&nbsp;';
    dom.addClass(gears, 'button gears');

    // TODO replace with FunctionController
    var button = document.createElement('span');
    button.innerHTML = 'Save';
    dom.addClass(button, 'button');
    dom.addClass(button, 'save');

    var button2 = document.createElement('span');
    button2.innerHTML = 'New';
    dom.addClass(button2, 'button');
    dom.addClass(button2, 'save-as');

    var button3 = document.createElement('span');
    button3.innerHTML = 'Revert';
    dom.addClass(button3, 'button');
    dom.addClass(button3, 'revert');

    var select = gui.__preset_select = document.createElement('select');

    if (gui.load && gui.load.remembered) {

      common.each(gui.load.remembered, function(value, key) {
        addPresetOption(gui, key, key == gui.preset);
      });

    } else {
      addPresetOption(gui, DEFAULT_DEFAULT_PRESET_NAME, false);
    }

    dom.bind(select, 'change', function() {


      for (var index = 0; index < gui.__preset_select.length; index++) {
        gui.__preset_select[index].innerHTML = gui.__preset_select[index].value;
      }

      gui.preset = this.value;

    });

    div.appendChild(select);
    div.appendChild(gears);
    div.appendChild(button);
    div.appendChild(button2);
    div.appendChild(button3);

    if (SUPPORTS_LOCAL_STORAGE) {

      var saveLocally = document.getElementById('dg-save-locally');
      var explain = document.getElementById('dg-local-explain');

      saveLocally.style.display = 'block';

      var localStorageCheckBox = document.getElementById('dg-local-storage');

      if (localStorage.getItem(getLocalStorageHash(gui, 'isLocal')) === 'true') {
        localStorageCheckBox.setAttribute('checked', 'checked');
      }

      function showHideExplain() {
        explain.style.display = gui.useLocalStorage ? 'block' : 'none';
      }

      showHideExplain();

      // TODO: Use a boolean controller, fool!
      dom.bind(localStorageCheckBox, 'change', function() {
        gui.useLocalStorage = !gui.useLocalStorage;
        showHideExplain();
      });

    }

    var newConstructorTextArea = document.getElementById('dg-new-constructor');

    dom.bind(newConstructorTextArea, 'keydown', function(e) {
      if (e.metaKey && (e.which === 67 || e.keyCode == 67)) {
        SAVE_DIALOGUE.hide();
      }
    });

    dom.bind(gears, 'click', function() {
      newConstructorTextArea.innerHTML = JSON.stringify(gui.getSaveObject(), undefined, 2);
      SAVE_DIALOGUE.show();
      newConstructorTextArea.focus();
      newConstructorTextArea.select();
    });

    dom.bind(button, 'click', function() {
      gui.save();
    });

    dom.bind(button2, 'click', function() {
      var presetName = prompt('Enter a new preset name.');
      if (presetName) gui.saveAs(presetName);
    });

    dom.bind(button3, 'click', function() {
      gui.revert();
    });

//    div.appendChild(button2);

  }

  function addResizeHandle(gui) {

    gui.__resize_handle = document.createElement('div');

    common.extend(gui.__resize_handle.style, {

      width: '6px',
      marginLeft: '-3px',
      height: '200px',
      cursor: 'ew-resize',
      position: 'absolute'
//      border: '1px solid blue'

    });

    var pmouseX;

    dom.bind(gui.__resize_handle, 'mousedown', dragStart);
    dom.bind(gui.__closeButton, 'mousedown', dragStart);

    gui.domElement.insertBefore(gui.__resize_handle, gui.domElement.firstElementChild);

    function dragStart(e) {

      e.preventDefault();

      pmouseX = e.clientX;

      dom.addClass(gui.__closeButton, GUI.CLASS_DRAG);
      dom.bind(window, 'mousemove', drag);
      dom.bind(window, 'mouseup', dragStop);

      return false;

    }

    function drag(e) {

      e.preventDefault();

      gui.width += pmouseX - e.clientX;
      gui.onResize();
      pmouseX = e.clientX;

      return false;

    }

    function dragStop() {

      dom.removeClass(gui.__closeButton, GUI.CLASS_DRAG);
      dom.unbind(window, 'mousemove', drag);
      dom.unbind(window, 'mouseup', dragStop);

    }

  }

  function setWidth(gui, w) {
    gui.domElement.style.width = w + 'px';
    // Auto placed save-rows are position fixed, so we have to
    // set the width manually if we want it to bleed to the edge
    if (gui.__save_row && gui.autoPlace) {
      gui.__save_row.style.width = w + 'px';
    }if (gui.__closeButton) {
      gui.__closeButton.style.width = w + 'px';
    }
  }

  function getCurrentPreset(gui, useInitialValues) {

    var toReturn = {};

    // For each object I'm remembering
    common.each(gui.__rememberedObjects, function(val, index) {

      var saved_values = {};

      // The controllers I've made for thcommon.isObject by property
      var controller_map =
          gui.__rememberedObjectIndecesToControllers[index];

      // Remember each value for each property
      common.each(controller_map, function(controller, property) {
        saved_values[property] = useInitialValues ? controller.initialValue : controller.getValue();
      });

      // Save the values for thcommon.isObject
      toReturn[index] = saved_values;

    });

    return toReturn;

  }

  function addPresetOption(gui, name, setSelected) {
    var opt = document.createElement('option');
    opt.innerHTML = name;
    opt.value = name;
    gui.__preset_select.appendChild(opt);
    if (setSelected) {
      gui.__preset_select.selectedIndex = gui.__preset_select.length - 1;
    }
  }

  function setPresetSelectIndex(gui) {
    for (var index = 0; index < gui.__preset_select.length; index++) {
      if (gui.__preset_select[index].value == gui.preset) {
        gui.__preset_select.selectedIndex = index;
      }
    }
  }

  function markPresetModified(gui, modified) {
    var opt = gui.__preset_select[gui.__preset_select.selectedIndex];
//    console.log('mark', modified, opt);
    if (modified) {
      opt.innerHTML = opt.value + "*";
    } else {
      opt.innerHTML = opt.value;
    }
  }

  function updateDisplays(controllerArray) {


    if (controllerArray.length != 0) {

      requestAnimationFrame(function() {
        updateDisplays(controllerArray);
      });

    }

    common.each(controllerArray, function(c) {
      c.updateDisplay();
    });

  }

  return GUI;

})(dat.utils.css,
"<div id=\"dg-save\" class=\"dg dialogue\">\n\n  Here's the new load parameter for your <code>GUI</code>'s constructor:\n\n  <textarea id=\"dg-new-constructor\"></textarea>\n\n  <div id=\"dg-save-locally\">\n\n    <input id=\"dg-local-storage\" type=\"checkbox\"/> Automatically save\n    values to <code>localStorage</code> on exit.\n\n    <div id=\"dg-local-explain\">The values saved to <code>localStorage</code> will\n      override those passed to <code>dat.GUI</code>'s constructor. This makes it\n      easier to work incrementally, but <code>localStorage</code> is fragile,\n      and your friends may not see the same values you do.\n      \n    </div>\n    \n  </div>\n\n</div>",
".dg ul{list-style:none;margin:0;padding:0;width:100%;clear:both}.dg.ac{position:fixed;top:0;left:0;right:0;height:0;z-index:0}.dg:not(.ac) .main{overflow:hidden}.dg.main{-webkit-transition:opacity 0.1s linear;-o-transition:opacity 0.1s linear;-moz-transition:opacity 0.1s linear;transition:opacity 0.1s linear}.dg.main.taller-than-window{overflow-y:auto}.dg.main.taller-than-window .close-button{opacity:1;margin-top:-1px;border-top:1px solid #2c2c2c}.dg.main ul.closed .close-button{opacity:1 !important}.dg.main:hover .close-button,.dg.main .close-button.drag{opacity:1}.dg.main .close-button{-webkit-transition:opacity 0.1s linear;-o-transition:opacity 0.1s linear;-moz-transition:opacity 0.1s linear;transition:opacity 0.1s linear;border:0;position:absolute;line-height:19px;height:20px;cursor:pointer;text-align:center;background-color:#000}.dg.main .close-button:hover{background-color:#111}.dg.a{float:right;margin-right:15px;overflow-x:hidden}.dg.a.has-save ul{margin-top:27px}.dg.a.has-save ul.closed{margin-top:0}.dg.a .save-row{position:fixed;top:0;z-index:1002}.dg li{-webkit-transition:height 0.1s ease-out;-o-transition:height 0.1s ease-out;-moz-transition:height 0.1s ease-out;transition:height 0.1s ease-out}.dg li:not(.folder){cursor:auto;height:27px;line-height:27px;overflow:hidden;padding:0 4px 0 5px}.dg li.folder{padding:0;border-left:4px solid rgba(0,0,0,0)}.dg li.title{cursor:pointer;margin-left:-4px}.dg .closed li:not(.title),.dg .closed ul li,.dg .closed ul li > *{height:0;overflow:hidden;border:0}.dg .cr{clear:both;padding-left:3px;height:27px}.dg .property-name{cursor:default;float:left;clear:left;width:40%;overflow:hidden;text-overflow:ellipsis}.dg .c{float:left;width:60%}.dg .c input[type=text]{border:0;margin-top:4px;padding:3px;width:100%;float:right}.dg .has-slider input[type=text]{width:30%;margin-left:0}.dg .slider{float:left;width:66%;margin-left:-5px;margin-right:0;height:19px;margin-top:4px}.dg .slider-fg{height:100%}.dg .c input[type=checkbox]{margin-top:9px}.dg .c select{margin-top:5px}.dg .cr.function,.dg .cr.function .property-name,.dg .cr.function *,.dg .cr.boolean,.dg .cr.boolean *{cursor:pointer}.dg .selector{display:none;position:absolute;margin-left:-9px;margin-top:23px;z-index:10}.dg .c:hover .selector,.dg .selector.drag{display:block}.dg li.save-row{padding:0}.dg li.save-row .button{display:inline-block;padding:0px 6px}.dg.dialogue{background-color:#222;width:460px;padding:15px;font-size:13px;line-height:15px}#dg-new-constructor{padding:10px;color:#222;font-family:Monaco, monospace;font-size:10px;border:0;resize:none;box-shadow:inset 1px 1px 1px #888;word-wrap:break-word;margin:12px 0;display:block;width:440px;overflow-y:scroll;height:100px;position:relative}#dg-local-explain{display:none;font-size:11px;line-height:17px;border-radius:3px;background-color:#333;padding:8px;margin-top:10px}#dg-local-explain code{font-size:10px}#dat-gui-save-locally{display:none}.dg{color:#eee;font:11px 'Lucida Grande', sans-serif;text-shadow:0 -1px 0 #111}.dg.main::-webkit-scrollbar{width:5px;background:#1a1a1a}.dg.main::-webkit-scrollbar-corner{height:0;display:none}.dg.main::-webkit-scrollbar-thumb{border-radius:5px;background:#676767}.dg li:not(.folder){background:#1a1a1a;border-bottom:1px solid #2c2c2c}.dg li.save-row{line-height:25px;background:#dad5cb;border:0}.dg li.save-row select{margin-left:5px;width:108px}.dg li.save-row .button{margin-left:5px;margin-top:1px;border-radius:2px;font-size:9px;line-height:7px;padding:4px 4px 5px 4px;background:#c5bdad;color:#fff;text-shadow:0 1px 0 #b0a58f;box-shadow:0 -1px 0 #b0a58f;cursor:pointer}.dg li.save-row .button.gears{background:#c5bdad url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAANCAYAAAB/9ZQ7AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQJJREFUeNpiYKAU/P//PwGIC/ApCABiBSAW+I8AClAcgKxQ4T9hoMAEUrxx2QSGN6+egDX+/vWT4e7N82AMYoPAx/evwWoYoSYbACX2s7KxCxzcsezDh3evFoDEBYTEEqycggWAzA9AuUSQQgeYPa9fPv6/YWm/Acx5IPb7ty/fw+QZblw67vDs8R0YHyQhgObx+yAJkBqmG5dPPDh1aPOGR/eugW0G4vlIoTIfyFcA+QekhhHJhPdQxbiAIguMBTQZrPD7108M6roWYDFQiIAAv6Aow/1bFwXgis+f2LUAynwoIaNcz8XNx3Dl7MEJUDGQpx9gtQ8YCueB+D26OECAAQDadt7e46D42QAAAABJRU5ErkJggg==) 2px 1px no-repeat;height:7px;width:8px}.dg li.save-row .button:hover{background-color:#bab19e;box-shadow:0 -1px 0 #b0a58f}.dg li.folder{border-bottom:0}.dg li.title{padding-left:16px;background:#000 url(data:image/gif;base64,R0lGODlhBQAFAJEAAP////Pz8////////yH5BAEAAAIALAAAAAAFAAUAAAIIlI+hKgFxoCgAOw==) 6px 10px no-repeat;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.2)}.dg .closed li.title{background-image:url(data:image/gif;base64,R0lGODlhBQAFAJEAAP////Pz8////////yH5BAEAAAIALAAAAAAFAAUAAAIIlGIWqMCbWAEAOw==)}.dg .cr.boolean{border-left:3px solid #806787}.dg .cr.function{border-left:3px solid #e61d5f}.dg .cr.number{border-left:3px solid #2fa1d6}.dg .cr.number input[type=text]{color:#2fa1d6}.dg .cr.string{border-left:3px solid #1ed36f}.dg .cr.string input[type=text]{color:#1ed36f}.dg .cr.function:hover,.dg .cr.boolean:hover{background:#111}.dg .c input[type=text]{background:#303030;outline:none}.dg .c input[type=text]:hover{background:#3c3c3c}.dg .c input[type=text]:focus{background:#494949;color:#fff}.dg .c .slider{background:#303030;cursor:ew-resize}.dg .c .slider-fg{background:#2fa1d6}.dg .c .slider:hover{background:#3c3c3c}.dg .c .slider:hover .slider-fg{background:#44abda}\n",
dat.controllers.factory = (function (OptionController, NumberControllerBox, NumberControllerSlider, StringController, FunctionController, BooleanController, common) {

      return function(object, property) {

        var initialValue = object[property];

        // Providing options?
        if (common.isArray(arguments[2]) || common.isObject(arguments[2])) {
          return new OptionController(object, property, arguments[2]);
        }

        // Providing a map?

        if (common.isNumber(initialValue)) {

          if (common.isNumber(arguments[2]) && common.isNumber(arguments[3])) {

            // Has min and max.
            return new NumberControllerSlider(object, property, arguments[2], arguments[3]);

          } else {

            return new NumberControllerBox(object, property, { min: arguments[2], max: arguments[3] });

          }

        }

        if (common.isString(initialValue)) {
          return new StringController(object, property);
        }

        if (common.isFunction(initialValue)) {
          return new FunctionController(object, property, '');
        }

        if (common.isBoolean(initialValue)) {
          return new BooleanController(object, property);
        }

      }

    })(dat.controllers.OptionController,
dat.controllers.NumberControllerBox,
dat.controllers.NumberControllerSlider,
dat.controllers.StringController = (function (Controller, dom, common) {

  /**
   * @class Provides a text input to alter the string property of an object.
   *
   * @extends dat.controllers.Controller
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   *
   * @member dat.controllers
   */
  var StringController = function(object, property) {

    StringController.superclass.call(this, object, property);

    var _this = this;

    this.__input = document.createElement('input');
    this.__input.setAttribute('type', 'text');

    dom.bind(this.__input, 'keyup', onChange);
    dom.bind(this.__input, 'change', onChange);
    dom.bind(this.__input, 'blur', onBlur);
    dom.bind(this.__input, 'keydown', function(e) {
      if (e.keyCode === 13) {
        this.blur();
      }
    });
    

    function onChange() {
      _this.setValue(_this.__input.value);
    }

    function onBlur() {
      if (_this.__onFinishChange) {
        _this.__onFinishChange.call(_this, _this.getValue());
      }
    }

    this.updateDisplay();

    this.domElement.appendChild(this.__input);

  };

  StringController.superclass = Controller;

  common.extend(

      StringController.prototype,
      Controller.prototype,

      {

        updateDisplay: function() {
          // Stops the caret from moving on account of:
          // keyup -> setValue -> updateDisplay
          if (!dom.isActive(this.__input)) {
            this.__input.value = this.getValue();
          }
          return StringController.superclass.prototype.updateDisplay.call(this);
        }

      }

  );

  return StringController;

})(dat.controllers.Controller,
dat.dom.dom,
dat.utils.common),
dat.controllers.FunctionController,
dat.controllers.BooleanController,
dat.utils.common),
dat.controllers.Controller,
dat.controllers.BooleanController,
dat.controllers.FunctionController,
dat.controllers.NumberControllerBox,
dat.controllers.NumberControllerSlider,
dat.controllers.OptionController,
dat.controllers.ColorController = (function (Controller, dom, Color, interpret, common) {

  var ColorController = function(object, property) {

    ColorController.superclass.call(this, object, property);

    this.__color = new Color(this.getValue());
    this.__temp = new Color(0);

    var _this = this;

    this.domElement = document.createElement('div');

    dom.makeSelectable(this.domElement, false);

    this.__selector = document.createElement('div');
    this.__selector.className = 'selector';

    this.__saturation_field = document.createElement('div');
    this.__saturation_field.className = 'saturation-field';

    this.__field_knob = document.createElement('div');
    this.__field_knob.className = 'field-knob';
    this.__field_knob_border = '2px solid ';

    this.__hue_knob = document.createElement('div');
    this.__hue_knob.className = 'hue-knob';

    this.__hue_field = document.createElement('div');
    this.__hue_field.className = 'hue-field';

    this.__input = document.createElement('input');
    this.__input.type = 'text';
    this.__input_textShadow = '0 1px 1px ';

    dom.bind(this.__input, 'keydown', function(e) {
      if (e.keyCode === 13) { // on enter
        onBlur.call(this);
      }
    });

    dom.bind(this.__input, 'blur', onBlur);

    dom.bind(this.__selector, 'mousedown', function(e) {

      dom
        .addClass(this, 'drag')
        .bind(window, 'mouseup', function(e) {
          dom.removeClass(_this.__selector, 'drag');
        });

    });

    var value_field = document.createElement('div');

    common.extend(this.__selector.style, {
      width: '122px',
      height: '102px',
      padding: '3px',
      backgroundColor: '#222',
      boxShadow: '0px 1px 3px rgba(0,0,0,0.3)'
    });

    common.extend(this.__field_knob.style, {
      position: 'absolute',
      width: '12px',
      height: '12px',
      border: this.__field_knob_border + (this.__color.v < .5 ? '#fff' : '#000'),
      boxShadow: '0px 1px 3px rgba(0,0,0,0.5)',
      borderRadius: '12px',
      zIndex: 1
    });
    
    common.extend(this.__hue_knob.style, {
      position: 'absolute',
      width: '15px',
      height: '2px',
      borderRight: '4px solid #fff',
      zIndex: 1
    });

    common.extend(this.__saturation_field.style, {
      width: '100px',
      height: '100px',
      border: '1px solid #555',
      marginRight: '3px',
      display: 'inline-block',
      cursor: 'pointer'
    });

    common.extend(value_field.style, {
      width: '100%',
      height: '100%',
      background: 'none'
    });
    
    linearGradient(value_field, 'top', 'rgba(0,0,0,0)', '#000');

    common.extend(this.__hue_field.style, {
      width: '15px',
      height: '100px',
      display: 'inline-block',
      border: '1px solid #555',
      cursor: 'ns-resize'
    });

    hueGradient(this.__hue_field);

    common.extend(this.__input.style, {
      outline: 'none',
//      width: '120px',
      textAlign: 'center',
//      padding: '4px',
//      marginBottom: '6px',
      color: '#fff',
      border: 0,
      fontWeight: 'bold',
      textShadow: this.__input_textShadow + 'rgba(0,0,0,0.7)'
    });

    dom.bind(this.__saturation_field, 'mousedown', fieldDown);
    dom.bind(this.__field_knob, 'mousedown', fieldDown);

    dom.bind(this.__hue_field, 'mousedown', function(e) {
      setH(e);
      dom.bind(window, 'mousemove', setH);
      dom.bind(window, 'mouseup', unbindH);
    });

    function fieldDown(e) {
      setSV(e);
      // document.body.style.cursor = 'none';
      dom.bind(window, 'mousemove', setSV);
      dom.bind(window, 'mouseup', unbindSV);
    }

    function unbindSV() {
      dom.unbind(window, 'mousemove', setSV);
      dom.unbind(window, 'mouseup', unbindSV);
      // document.body.style.cursor = 'default';
    }

    function onBlur() {
      var i = interpret(this.value);
      if (i !== false) {
        _this.__color.__state = i;
        _this.setValue(_this.__color.toOriginal());
      } else {
        this.value = _this.__color.toString();
      }
    }

    function unbindH() {
      dom.unbind(window, 'mousemove', setH);
      dom.unbind(window, 'mouseup', unbindH);
    }

    this.__saturation_field.appendChild(value_field);
    this.__selector.appendChild(this.__field_knob);
    this.__selector.appendChild(this.__saturation_field);
    this.__selector.appendChild(this.__hue_field);
    this.__hue_field.appendChild(this.__hue_knob);

    this.domElement.appendChild(this.__input);
    this.domElement.appendChild(this.__selector);

    this.updateDisplay();

    function setSV(e) {

      e.preventDefault();

      var w = dom.getWidth(_this.__saturation_field);
      var o = dom.getOffset(_this.__saturation_field);
      var s = (e.clientX - o.left + document.body.scrollLeft) / w;
      var v = 1 - (e.clientY - o.top + document.body.scrollTop) / w;

      if (v > 1) v = 1;
      else if (v < 0) v = 0;

      if (s > 1) s = 1;
      else if (s < 0) s = 0;

      _this.__color.v = v;
      _this.__color.s = s;

      _this.setValue(_this.__color.toOriginal());


      return false;

    }

    function setH(e) {

      e.preventDefault();

      var s = dom.getHeight(_this.__hue_field);
      var o = dom.getOffset(_this.__hue_field);
      var h = 1 - (e.clientY - o.top + document.body.scrollTop) / s;

      if (h > 1) h = 1;
      else if (h < 0) h = 0;

      _this.__color.h = h * 360;

      _this.setValue(_this.__color.toOriginal());

      return false;

    }

  };

  ColorController.superclass = Controller;

  common.extend(

      ColorController.prototype,
      Controller.prototype,

      {

        updateDisplay: function() {

          var i = interpret(this.getValue());

          if (i !== false) {

            var mismatch = false;

            // Check for mismatch on the interpreted value.

            common.each(Color.COMPONENTS, function(component) {
              if (!common.isUndefined(i[component]) &&
                  !common.isUndefined(this.__color.__state[component]) &&
                  i[component] !== this.__color.__state[component]) {
                mismatch = true;
                return {}; // break
              }
            }, this);

            // If nothing diverges, we keep our previous values
            // for statefulness, otherwise we recalculate fresh
            if (mismatch) {
              common.extend(this.__color.__state, i);
            }

          }

          common.extend(this.__temp.__state, this.__color.__state);

          this.__temp.a = 1;

          var flip = (this.__color.v < .5 || this.__color.s > .5) ? 255 : 0;
          var _flip = 255 - flip;

          common.extend(this.__field_knob.style, {
            marginLeft: 100 * this.__color.s - 7 + 'px',
            marginTop: 100 * (1 - this.__color.v) - 7 + 'px',
            backgroundColor: this.__temp.toString(),
            border: this.__field_knob_border + 'rgb(' + flip + ',' + flip + ',' + flip +')'
          });

          this.__hue_knob.style.marginTop = (1 - this.__color.h / 360) * 100 + 'px'

          this.__temp.s = 1;
          this.__temp.v = 1;

          linearGradient(this.__saturation_field, 'left', '#fff', this.__temp.toString());

          common.extend(this.__input.style, {
            backgroundColor: this.__input.value = this.__color.toString(),
            color: 'rgb(' + flip + ',' + flip + ',' + flip +')',
            textShadow: this.__input_textShadow + 'rgba(' + _flip + ',' + _flip + ',' + _flip +',.7)'
          });

        }

      }

  );
  
  var vendors = ['-moz-','-o-','-webkit-','-ms-',''];
  
  function linearGradient(elem, x, a, b) {
    elem.style.background = '';
    common.each(vendors, function(vendor) {
      elem.style.cssText += 'background: ' + vendor + 'linear-gradient('+x+', '+a+' 0%, ' + b + ' 100%); ';
    });
  }
  
  function hueGradient(elem) {
    elem.style.background = '';
    elem.style.cssText += 'background: -moz-linear-gradient(top,  #ff0000 0%, #ff00ff 17%, #0000ff 34%, #00ffff 50%, #00ff00 67%, #ffff00 84%, #ff0000 100%);'
    elem.style.cssText += 'background: -webkit-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);'
    elem.style.cssText += 'background: -o-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);'
    elem.style.cssText += 'background: -ms-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);'
    elem.style.cssText += 'background: linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);'
  }


  return ColorController;

})(dat.controllers.Controller,
dat.dom.dom,
dat.color.Color = (function (interpret, math, toString, common) {

  var Color = function() {

    this.__state = interpret.apply(this, arguments);

    if (this.__state === false) {
      throw 'Failed to interpret color arguments';
    }

    this.__state.a = this.__state.a || 1;


  };

  Color.COMPONENTS = ['r','g','b','h','s','v','hex','a'];

  common.extend(Color.prototype, {

    toString: function() {
      return toString(this);
    },

    toOriginal: function() {
      return this.__state.conversion.write(this);
    }

  });

  defineRGBComponent(Color.prototype, 'r', 2);
  defineRGBComponent(Color.prototype, 'g', 1);
  defineRGBComponent(Color.prototype, 'b', 0);

  defineHSVComponent(Color.prototype, 'h');
  defineHSVComponent(Color.prototype, 's');
  defineHSVComponent(Color.prototype, 'v');

  Object.defineProperty(Color.prototype, 'a', {

    get: function() {
      return this.__state.a;
    },

    set: function(v) {
      this.__state.a = v;
    }

  });

  Object.defineProperty(Color.prototype, 'hex', {

    get: function() {

      if (!this.__state.space !== 'HEX') {
        this.__state.hex = math.rgb_to_hex(this.r, this.g, this.b);
      }

      return this.__state.hex;

    },

    set: function(v) {

      this.__state.space = 'HEX';
      this.__state.hex = v;

    }

  });

  function defineRGBComponent(target, component, componentHexIndex) {

    Object.defineProperty(target, component, {

      get: function() {

        if (this.__state.space === 'RGB') {
          return this.__state[component];
        }

        recalculateRGB(this, component, componentHexIndex);

        return this.__state[component];

      },

      set: function(v) {

        if (this.__state.space !== 'RGB') {
          recalculateRGB(this, component, componentHexIndex);
          this.__state.space = 'RGB';
        }

        this.__state[component] = v;

      }

    });

  }

  function defineHSVComponent(target, component) {

    Object.defineProperty(target, component, {

      get: function() {

        if (this.__state.space === 'HSV')
          return this.__state[component];

        recalculateHSV(this);

        return this.__state[component];

      },

      set: function(v) {

        if (this.__state.space !== 'HSV') {
          recalculateHSV(this);
          this.__state.space = 'HSV';
        }

        this.__state[component] = v;

      }

    });

  }

  function recalculateRGB(color, component, componentHexIndex) {

    if (color.__state.space === 'HEX') {

      color.__state[component] = math.component_from_hex(color.__state.hex, componentHexIndex);

    } else if (color.__state.space === 'HSV') {

      common.extend(color.__state, math.hsv_to_rgb(color.__state.h, color.__state.s, color.__state.v));

    } else {

      throw 'Corrupted color state';

    }

  }

  function recalculateHSV(color) {

    var result = math.rgb_to_hsv(color.r, color.g, color.b);

    common.extend(color.__state,
        {
          s: result.s,
          v: result.v
        }
    );

    if (!common.isNaN(result.h)) {
      color.__state.h = result.h;
    } else if (common.isUndefined(color.__state.h)) {
      color.__state.h = 0;
    }

  }

  return Color;

})(dat.color.interpret,
dat.color.math = (function () {

  var tmpComponent;

  return {

    hsv_to_rgb: function(h, s, v) {

      var hi = Math.floor(h / 60) % 6;

      var f = h / 60 - Math.floor(h / 60);
      var p = v * (1.0 - s);
      var q = v * (1.0 - (f * s));
      var t = v * (1.0 - ((1.0 - f) * s));
      var c = [
        [v, t, p],
        [q, v, p],
        [p, v, t],
        [p, q, v],
        [t, p, v],
        [v, p, q]
      ][hi];

      return {
        r: c[0] * 255,
        g: c[1] * 255,
        b: c[2] * 255
      };

    },

    rgb_to_hsv: function(r, g, b) {

      var min = Math.min(r, g, b),
          max = Math.max(r, g, b),
          delta = max - min,
          h, s;

      if (max != 0) {
        s = delta / max;
      } else {
        return {
          h: NaN,
          s: 0,
          v: 0
        };
      }

      if (r == max) {
        h = (g - b) / delta;
      } else if (g == max) {
        h = 2 + (b - r) / delta;
      } else {
        h = 4 + (r - g) / delta;
      }
      h /= 6;
      if (h < 0) {
        h += 1;
      }

      return {
        h: h * 360,
        s: s,
        v: max / 255
      };
    },

    rgb_to_hex: function(r, g, b) {
      var hex = this.hex_with_component(0, 2, r);
      hex = this.hex_with_component(hex, 1, g);
      hex = this.hex_with_component(hex, 0, b);
      return hex;
    },

    component_from_hex: function(hex, componentIndex) {
      return (hex >> (componentIndex * 8)) & 0xFF;
    },

    hex_with_component: function(hex, componentIndex, value) {
      return value << (tmpComponent = componentIndex * 8) | (hex & ~ (0xFF << tmpComponent));
    }

  }

})(),
dat.color.toString,
dat.utils.common),
dat.color.interpret,
dat.utils.common),
dat.utils.requestAnimationFrame = (function () {

  /**
   * requirejs version of Paul Irish's RequestAnimationFrame
   * http://paulirish.com/2011/requestanimationframe-for-smart-animating/
   */

  return window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      function(callback, element) {

        window.setTimeout(callback, 1000 / 60);

      };
})(),
dat.dom.CenteredDiv = (function (dom, common) {


  var CenteredDiv = function() {

    this.backgroundElement = document.createElement('div');
    common.extend(this.backgroundElement.style, {
      backgroundColor: 'rgba(0,0,0,0.8)',
      top: 0,
      left: 0,
      display: 'none',
      zIndex: '1000',
      opacity: 0,
      WebkitTransition: 'opacity 0.2s linear'
    });

    dom.makeFullscreen(this.backgroundElement);
    this.backgroundElement.style.position = 'fixed';

    this.domElement = document.createElement('div');
    common.extend(this.domElement.style, {
      position: 'fixed',
      display: 'none',
      zIndex: '1001',
      opacity: 0,
      WebkitTransition: '-webkit-transform 0.2s ease-out, opacity 0.2s linear'
    });


    document.body.appendChild(this.backgroundElement);
    document.body.appendChild(this.domElement);

    var _this = this;
    dom.bind(this.backgroundElement, 'click', function() {
      _this.hide();
    });


  };

  CenteredDiv.prototype.show = function() {

    var _this = this;
    


    this.backgroundElement.style.display = 'block';

    this.domElement.style.display = 'block';
    this.domElement.style.opacity = 0;
//    this.domElement.style.top = '52%';
    this.domElement.style.webkitTransform = 'scale(1.1)';

    this.layout();

    common.defer(function() {
      _this.backgroundElement.style.opacity = 1;
      _this.domElement.style.opacity = 1;
      _this.domElement.style.webkitTransform = 'scale(1)';
    });

  };

  CenteredDiv.prototype.hide = function() {

    var _this = this;

    var hide = function() {

      _this.domElement.style.display = 'none';
      _this.backgroundElement.style.display = 'none';

      dom.unbind(_this.domElement, 'webkitTransitionEnd', hide);
      dom.unbind(_this.domElement, 'transitionend', hide);
      dom.unbind(_this.domElement, 'oTransitionEnd', hide);

    };

    dom.bind(this.domElement, 'webkitTransitionEnd', hide);
    dom.bind(this.domElement, 'transitionend', hide);
    dom.bind(this.domElement, 'oTransitionEnd', hide);

    this.backgroundElement.style.opacity = 0;
//    this.domElement.style.top = '48%';
    this.domElement.style.opacity = 0;
    this.domElement.style.webkitTransform = 'scale(1.1)';

  };

  CenteredDiv.prototype.layout = function() {
    this.domElement.style.left = window.innerWidth/2 - dom.getWidth(this.domElement) / 2 + 'px';
    this.domElement.style.top = window.innerHeight/2 - dom.getHeight(this.domElement) / 2 + 'px';
  };
  
  function lockScroll(e) {
    console.log(e);
  }

  return CenteredDiv;

})(dat.dom.dom,
dat.utils.common),
dat.dom.dom,
dat.utils.common);
},{}],5:[function(require,module,exports){
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

// namespace ?
var jsfeat = jsfeat || { REVISION: 'ALPHA' };
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

(function(global) {
    "use strict";
    //

    // CONSTANTS
    var EPSILON = 0.0000001192092896;
    var FLT_MIN = 1E-37;

    // implementation from CCV project
    // currently working only with u8,s32,f32
    var U8_t = 0x0100,
        S32_t = 0x0200,
        F32_t = 0x0400,
        S64_t = 0x0800,
        F64_t = 0x1000;

    var C1_t = 0x01,
        C2_t = 0x02,
        C3_t = 0x03,
        C4_t = 0x04;

    var _data_type_size = new Int32Array([ -1, 1, 4, -1, 4, -1, -1, -1, 8, -1, -1, -1, -1, -1, -1, -1, 8 ]);

    var get_data_type = (function () {
        return function(type) {
            return (type & 0xFF00);
        }
    })();

    var get_channel = (function () {
        return function(type) {
            return (type & 0xFF);
        }
    })();

    var get_data_type_size = (function () {
        return function(type) {
            return _data_type_size[(type & 0xFF00) >> 8];
        }
    })();

    // color conversion
    var COLOR_RGBA2GRAY = 0;
    var COLOR_RGB2GRAY = 1;
    var COLOR_BGRA2GRAY = 2;
    var COLOR_BGR2GRAY = 3;

    // box blur option
    var BOX_BLUR_NOSCALE = 0x01;
    // svd options
    var SVD_U_T = 0x01;
    var SVD_V_T = 0x02;

    var data_t = (function () {
        function data_t(size_in_bytes, buffer) {
            // we need align size to multiple of 8
            this.size = ((size_in_bytes + 7) | 0) & -8;
            if (typeof buffer === "undefined") { 
                this.buffer = new ArrayBuffer(this.size);
            } else {
                this.buffer = buffer;
                this.size = buffer.length;
            }
            this.u8 = new Uint8Array(this.buffer);
            this.i32 = new Int32Array(this.buffer);
            this.f32 = new Float32Array(this.buffer);
            this.f64 = new Float64Array(this.buffer);
        }
        return data_t;
    })();

    var matrix_t = (function () {
        // columns, rows, data_type
        function matrix_t(c, r, data_type, data_buffer) {
            this.type = get_data_type(data_type)|0;
            this.channel = get_channel(data_type)|0;
            this.cols = c|0;
            this.rows = r|0;
            if (typeof data_buffer === "undefined") { 
                this.allocate();
            } else {
                this.buffer = data_buffer;
                // data user asked for
                this.data = this.type&U8_t ? this.buffer.u8 : (this.type&S32_t ? this.buffer.i32 : (this.type&F32_t ? this.buffer.f32 : this.buffer.f64));
            }
        }
        matrix_t.prototype.allocate = function() {
            // clear references
            delete this.data;
            delete this.buffer;
            //
            this.buffer = new data_t((this.cols * get_data_type_size(this.type) * this.channel) * this.rows);
            this.data = this.type&U8_t ? this.buffer.u8 : (this.type&S32_t ? this.buffer.i32 : (this.type&F32_t ? this.buffer.f32 : this.buffer.f64));
        }
        matrix_t.prototype.copy_to = function(other) {
            var od = other.data, td = this.data;
            var i = 0, n = (this.cols*this.rows*this.channel)|0;
            for(; i < n-4; i+=4) {
                od[i] = td[i];
                od[i+1] = td[i+1];
                od[i+2] = td[i+2];
                od[i+3] = td[i+3];
            }
            for(; i < n; ++i) {
                od[i] = td[i];
            }
        }
        matrix_t.prototype.resize = function(c, r, ch) {
            if (typeof ch === "undefined") { ch = this.channel; }
            // relocate buffer only if new size doesnt fit
            var new_size = (c * get_data_type_size(this.type) * ch) * r;
            if(new_size > this.buffer.size) {
                this.cols = c;
                this.rows = r;
                this.channel = ch;
                this.allocate();
            } else {
                this.cols = c;
                this.rows = r;
                this.channel = ch;
            }
        }

        return matrix_t;
    })();

    var pyramid_t = (function () {

        function pyramid_t(levels) {
            this.levels = levels|0;
            this.data = new Array(levels);
            this.pyrdown = jsfeat.imgproc.pyrdown;
        }

        pyramid_t.prototype.allocate = function(start_w, start_h, data_type) {
            var i = this.levels;
            while(--i >= 0) {
                this.data[i] = new matrix_t(start_w >> i, start_h >> i, data_type);
            }
        }

        pyramid_t.prototype.build = function(input, skip_first_level) {
            if (typeof skip_first_level === "undefined") { skip_first_level = true; }
            // just copy data to first level
            var i = 2, a = input, b = this.data[0];
            if(!skip_first_level) {
                var j=input.cols*input.rows;
                while(--j >= 0) {
                    b.data[j] = input.data[j];
                }
            }
            b = this.data[1];
            this.pyrdown(a, b);
            for(; i < this.levels; ++i) {
                a = b;
                b = this.data[i];
                this.pyrdown(a, b);
            }
        }

        return pyramid_t;
    })();

    var keypoint_t = (function () {
        function keypoint_t(x,y,score,level,angle) {
            if (typeof x === "undefined") { x=0; }
            if (typeof y === "undefined") { y=0; }
            if (typeof score === "undefined") { score=0; }
            if (typeof level === "undefined") { level=0; }
            if (typeof angle === "undefined") { angle=-1.0; }

            this.x = x;
            this.y = y;
            this.score = score;
            this.level = level;
            this.angle = angle;
        }
        return keypoint_t;
    })();


    // data types
    global.U8_t = U8_t;
    global.S32_t = S32_t;
    global.F32_t = F32_t;
    global.S64_t = S64_t;
    global.F64_t = F64_t;
    // data channels
    global.C1_t = C1_t;
    global.C2_t = C2_t;
    global.C3_t = C3_t;
    global.C4_t = C4_t;

    // popular formats
    global.U8C1_t = U8_t | C1_t;
    global.U8C3_t = U8_t | C3_t;
    global.U8C4_t = U8_t | C4_t;

    global.F32C1_t = F32_t | C1_t;
    global.F32C2_t = F32_t | C2_t;
    global.S32C1_t = S32_t | C1_t;
    global.S32C2_t = S32_t | C2_t;

    // constants
    global.EPSILON = EPSILON;
    global.FLT_MIN = FLT_MIN;

    // color convert
    global.COLOR_RGBA2GRAY = COLOR_RGBA2GRAY;
    global.COLOR_RGB2GRAY = COLOR_RGB2GRAY;
    global.COLOR_BGRA2GRAY = COLOR_BGRA2GRAY;
    global.COLOR_BGR2GRAY = COLOR_BGR2GRAY;

    // options
    global.BOX_BLUR_NOSCALE = BOX_BLUR_NOSCALE;
    global.SVD_U_T = SVD_U_T;
    global.SVD_V_T = SVD_V_T;

    global.get_data_type = get_data_type;
    global.get_channel = get_channel;
    global.get_data_type_size = get_data_type_size;

    global.data_t = data_t;
    global.matrix_t = matrix_t;
    global.pyramid_t = pyramid_t;
    global.keypoint_t = keypoint_t;

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

(function(global) {
    "use strict";
    //

    var cache = (function() {

        // very primitive array cache, still need testing if it helps
        // of course V8 has its own powerful cache sys but i'm not sure
        // it caches several multichannel 640x480 buffer creations each frame

        var _pool_node_t = (function () {
            function _pool_node_t(size_in_bytes) {
                this.next = null;
                this.data = new jsfeat.data_t(size_in_bytes);
                this.size = this.data.size;
                this.buffer = this.data.buffer;
                this.u8 = this.data.u8;
                this.i32 = this.data.i32;
                this.f32 = this.data.f32;
                this.f64 = this.data.f64;
            }
            _pool_node_t.prototype.resize = function(size_in_bytes) {
                delete this.data;
                this.data = new jsfeat.data_t(size_in_bytes);
                this.size = this.data.size;
                this.buffer = this.data.buffer;
                this.u8 = this.data.u8;
                this.i32 = this.data.i32;
                this.f32 = this.data.f32;
                this.f64 = this.data.f64;
            }
            return _pool_node_t;
        })();

        var _pool_head, _pool_tail;
        var _pool_size = 0;

        return {

            allocate: function(capacity, data_size) {
                _pool_head = _pool_tail = new _pool_node_t(data_size);
                for (var i = 0; i < capacity; ++i) {
                    var node = new _pool_node_t(data_size);
                    _pool_tail = _pool_tail.next = node;

                    _pool_size++;
                }
            },

            get_buffer: function(size_in_bytes) {
                // assume we have enough free nodes
                var node = _pool_head;
                _pool_head = _pool_head.next;
                _pool_size--;

                if(size_in_bytes > node.size) {
                    node.resize(size_in_bytes);
                }

                return node;
            },

            put_buffer: function(node) {
                _pool_tail = _pool_tail.next = node;
                _pool_size++;
            }
        };
    })();

    global.cache = cache;
    // for now we dont need more than 30 buffers
    // if having cache sys really helps we can add auto extending sys
    cache.allocate(30, 640*4);

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

(function(global) {
    "use strict";
    //

    var math = (function() {

        var qsort_stack = new Int32Array(48*2);

        return {
            get_gaussian_kernel: function(size, sigma, kernel, data_type) {
                var i=0,x=0.0,t=0.0,sigma_x=0.0,scale_2x=0.0;
                var sum = 0.0;
                var kern_node = jsfeat.cache.get_buffer(size<<2);
                var _kernel = kern_node.f32;//new Float32Array(size);

                if((size&1) == 1 && size <= 7 && sigma <= 0) {
                    switch(size>>1) {
                        case 0:
                        _kernel[0] = 1.0;
                        sum = 1.0;
                        break;
                        case 1:
                        _kernel[0] = 0.25, _kernel[1] = 0.5, _kernel[2] = 0.25;
                        sum = 0.25+0.5+0.25;
                        break;
                        case 2:
                        _kernel[0] = 0.0625, _kernel[1] = 0.25, _kernel[2] = 0.375, 
                        _kernel[3] = 0.25, _kernel[4] = 0.0625;
                        sum = 0.0625+0.25+0.375+0.25+0.0625;
                        break;
                        case 3:
                        _kernel[0] = 0.03125, _kernel[1] = 0.109375, _kernel[2] = 0.21875, 
                        _kernel[3] = 0.28125, _kernel[4] = 0.21875, _kernel[5] = 0.109375, _kernel[6] = 0.03125;
                        sum = 0.03125+0.109375+0.21875+0.28125+0.21875+0.109375+0.03125;
                        break;
                    }
                } else {
                    sigma_x = sigma > 0 ? sigma : ((size-1)*0.5 - 1.0)*0.3 + 0.8;
                    scale_2x = -0.5/(sigma_x*sigma_x);

                    for( ; i < size; ++i )
                    {
                        x = i - (size-1)*0.5;
                        t = Math.exp(scale_2x*x*x);

                        _kernel[i] = t;
                        sum += t;
                    }
                }

                if(data_type & jsfeat.U8_t) {
                    // int based kernel
                    sum = 256.0/sum;
                    for (i = 0; i < size; ++i) {
                        kernel[i] = (_kernel[i] * sum + 0.5)|0;
                    }
                } else {
                    // classic kernel
                    sum = 1.0/sum;
                    for (i = 0; i < size; ++i) {
                        kernel[i] = _kernel[i] * sum;
                    }
                }

                jsfeat.cache.put_buffer(kern_node);
            },

            // model is 3x3 matrix_t
            perspective_4point_transform: function(model, src_x0, src_y0, dst_x0, dst_y0,
                                                        src_x1, src_y1, dst_x1, dst_y1,
                                                        src_x2, src_y2, dst_x2, dst_y2,
                                                        src_x3, src_y3, dst_x3, dst_y3) {
                var t1 = src_x0;
                var t2 = src_x2;
                var t4 = src_y1;
                var t5 = t1 * t2 * t4;
                var t6 = src_y3;
                var t7 = t1 * t6;
                var t8 = t2 * t7;
                var t9 = src_y2;
                var t10 = t1 * t9;
                var t11 = src_x1;
                var t14 = src_y0;
                var t15 = src_x3;
                var t16 = t14 * t15;
                var t18 = t16 * t11;
                var t20 = t15 * t11 * t9;
                var t21 = t15 * t4;
                var t24 = t15 * t9;
                var t25 = t2 * t4;
                var t26 = t6 * t2;
                var t27 = t6 * t11;
                var t28 = t9 * t11;
                var t30 = 1.0 / (t21-t24 - t25 + t26 - t27 + t28);
                var t32 = t1 * t15;
                var t35 = t14 * t11;
                var t41 = t4 * t1;
                var t42 = t6 * t41;
                var t43 = t14 * t2;
                var t46 = t16 * t9;
                var t48 = t14 * t9 * t11;
                var t51 = t4 * t6 * t2;
                var t55 = t6 * t14;
                var Hr0 = -(t8-t5 + t10 * t11 - t11 * t7 - t16 * t2 + t18 - t20 + t21 * t2) * t30;
                var Hr1 = (t5 - t8 - t32 * t4 + t32 * t9 + t18 - t2 * t35 + t27 * t2 - t20) * t30;
                var Hr2 = t1;
                var Hr3 = (-t9 * t7 + t42 + t43 * t4 - t16 * t4 + t46 - t48 + t27 * t9 - t51) * t30;
                var Hr4 = (-t42 + t41 * t9 - t55 * t2 + t46 - t48 + t55 * t11 + t51 - t21 * t9) * t30;
                var Hr5 = t14;
                var Hr6 = (-t10 + t41 + t43 - t35 + t24 - t21 - t26 + t27) * t30;
                var Hr7 = (-t7 + t10 + t16 - t43 + t27 - t28 - t21 + t25) * t30;
                
                t1 = dst_x0;
                t2 = dst_x2;
                t4 = dst_y1;
                t5 = t1 * t2 * t4;
                t6 = dst_y3;
                t7 = t1 * t6;
                t8 = t2 * t7;
                t9 = dst_y2;
                t10 = t1 * t9;
                t11 = dst_x1;
                t14 = dst_y0;
                t15 = dst_x3;
                t16 = t14 * t15;
                t18 = t16 * t11;
                t20 = t15 * t11 * t9;
                t21 = t15 * t4;
                t24 = t15 * t9;
                t25 = t2 * t4;
                t26 = t6 * t2;
                t27 = t6 * t11;
                t28 = t9 * t11;
                t30 = 1.0 / (t21-t24 - t25 + t26 - t27 + t28);
                t32 = t1 * t15;
                t35 = t14 * t11;
                t41 = t4 * t1;
                t42 = t6 * t41;
                t43 = t14 * t2;
                t46 = t16 * t9;
                t48 = t14 * t9 * t11;
                t51 = t4 * t6 * t2;
                t55 = t6 * t14;
                var Hl0 = -(t8-t5 + t10 * t11 - t11 * t7 - t16 * t2 + t18 - t20 + t21 * t2) * t30;
                var Hl1 = (t5 - t8 - t32 * t4 + t32 * t9 + t18 - t2 * t35 + t27 * t2 - t20) * t30;
                var Hl2 = t1;
                var Hl3 = (-t9 * t7 + t42 + t43 * t4 - t16 * t4 + t46 - t48 + t27 * t9 - t51) * t30;
                var Hl4 = (-t42 + t41 * t9 - t55 * t2 + t46 - t48 + t55 * t11 + t51 - t21 * t9) * t30;
                var Hl5 = t14;
                var Hl6 = (-t10 + t41 + t43 - t35 + t24 - t21 - t26 + t27) * t30;
                var Hl7 = (-t7 + t10 + t16 - t43 + t27 - t28 - t21 + t25) * t30;

                // the following code computes R = Hl * inverse Hr
                t2 = Hr4-Hr7*Hr5;
                t4 = Hr0*Hr4;
                t5 = Hr0*Hr5;
                t7 = Hr3*Hr1;
                t8 = Hr2*Hr3;
                t10 = Hr1*Hr6;
                var t12 = Hr2*Hr6;
                t15 = 1.0 / (t4-t5*Hr7-t7+t8*Hr7+t10*Hr5-t12*Hr4);
                t18 = -Hr3+Hr5*Hr6;
                var t23 = -Hr3*Hr7+Hr4*Hr6;
                t28 = -Hr1+Hr2*Hr7;
                var t31 = Hr0-t12;
                t35 = Hr0*Hr7-t10;
                t41 = -Hr1*Hr5+Hr2*Hr4;
                var t44 = t5-t8;
                var t47 = t4-t7;
                t48 = t2*t15;
                var t49 = t28*t15;
                var t50 = t41*t15;
                var mat = model.data;
                mat[0] = Hl0*t48+Hl1*(t18*t15)-Hl2*(t23*t15);
                mat[1] = Hl0*t49+Hl1*(t31*t15)-Hl2*(t35*t15);
                mat[2] = -Hl0*t50-Hl1*(t44*t15)+Hl2*(t47*t15);
                mat[3] = Hl3*t48+Hl4*(t18*t15)-Hl5*(t23*t15);
                mat[4] = Hl3*t49+Hl4*(t31*t15)-Hl5*(t35*t15);
                mat[5] = -Hl3*t50-Hl4*(t44*t15)+Hl5*(t47*t15);
                mat[6] = Hl6*t48+Hl7*(t18*t15)-t23*t15;
                mat[7] = Hl6*t49+Hl7*(t31*t15)-t35*t15;
                mat[8] = -Hl6*t50-Hl7*(t44*t15)+t47*t15;
            },

            // The current implementation was derived from *BSD system qsort():
            // Copyright (c) 1992, 1993
            // The Regents of the University of California.  All rights reserved.
            qsort: function(array, low, high, cmp) {
                var isort_thresh = 7;
                var t,ta,tb,tc;
                var sp = 0,left=0,right=0,i=0,n=0,m=0,ptr=0,ptr2=0,d=0;
                var left0=0,left1=0,right0=0,right1=0,pivot=0,a=0,b=0,c=0,swap_cnt=0;

                var stack = qsort_stack;

                if( (high-low+1) <= 1 ) return;

                stack[0] = low;
                stack[1] = high;

                while( sp >= 0 ) {
                
                    left = stack[sp<<1];
                    right = stack[(sp<<1)+1];
                    sp--;

                    for(;;) {
                        n = (right - left) + 1;

                        if( n <= isort_thresh ) {
                        //insert_sort:
                            for( ptr = left + 1; ptr <= right; ptr++ ) {
                                for( ptr2 = ptr; ptr2 > left && cmp(array[ptr2],array[ptr2-1]); ptr2--) {
                                    t = array[ptr2];
                                    array[ptr2] = array[ptr2-1];
                                    array[ptr2-1] = t;
                                }
                            }
                            break;
                        } else {
                            swap_cnt = 0;

                            left0 = left;
                            right0 = right;
                            pivot = left + (n>>1);

                            if( n > 40 ) {
                                d = n >> 3;
                                a = left, b = left + d, c = left + (d<<1);
                                ta = array[a],tb = array[b],tc = array[c];
                                left = cmp(ta, tb) ? (cmp(tb, tc) ? b : (cmp(ta, tc) ? c : a))
                                                  : (cmp(tc, tb) ? b : (cmp(ta, tc) ? a : c));

                                a = pivot - d, b = pivot, c = pivot + d;
                                ta = array[a],tb = array[b],tc = array[c];
                                pivot = cmp(ta, tb) ? (cmp(tb, tc) ? b : (cmp(ta, tc) ? c : a))
                                                  : (cmp(tc, tb) ? b : (cmp(ta, tc) ? a : c));

                                a = right - (d<<1), b = right - d, c = right;
                                ta = array[a],tb = array[b],tc = array[c];
                                right = cmp(ta, tb) ? (cmp(tb, tc) ? b : (cmp(ta, tc) ? c : a))
                                                  : (cmp(tc, tb) ? b : (cmp(ta, tc) ? a : c));
                            }

                            a = left, b = pivot, c = right;
                            ta = array[a],tb = array[b],tc = array[c];
                            pivot = cmp(ta, tb) ? (cmp(tb, tc) ? b : (cmp(ta, tc) ? c : a))   
                                               : (cmp(tc, tb) ? b : (cmp(ta, tc) ? a : c));
                            if( pivot != left0 ) {
                                t = array[pivot];
                                array[pivot] = array[left0];
                                array[left0] = t;
                                pivot = left0;
                            }
                            left = left1 = left0 + 1;
                            right = right1 = right0;

                            ta = array[pivot];
                            for(;;) {
                                while( left <= right && !cmp(ta, array[left]) ) {
                                    if( !cmp(array[left], ta) ) {
                                        if( left > left1 ) {
                                            t = array[left1];
                                            array[left1] = array[left];
                                            array[left] = t;
                                        }
                                        swap_cnt = 1;
                                        left1++;
                                    }
                                    left++;
                                }

                                while( left <= right && !cmp(array[right], ta) ) {
                                    if( !cmp(ta, array[right]) ) {
                                        if( right < right1 ) {
                                            t = array[right1];
                                            array[right1] = array[right];
                                            array[right] = t;
                                        }
                                        swap_cnt = 1;
                                        right1--;
                                    }
                                    right--;
                                }

                                if( left > right ) break;
                                
                                t = array[left];
                                array[left] = array[right];
                                array[right] = t;
                                swap_cnt = 1;
                                left++;
                                right--;
                            }

                            if( swap_cnt == 0 ) {
                                left = left0, right = right0;
                                //goto insert_sort;
                                for( ptr = left + 1; ptr <= right; ptr++ ) {
                                    for( ptr2 = ptr; ptr2 > left && cmp(array[ptr2],array[ptr2-1]); ptr2--) {
                                        t = array[ptr2];
                                        array[ptr2] = array[ptr2-1];
                                        array[ptr2-1] = t;
                                    }
                                }
                                break;
                            }

                            n = Math.min( (left1 - left0), (left - left1) );
                            m = (left-n)|0;
                            for( i = 0; i < n; ++i,++m ) {
                                t = array[left0+i];
                                array[left0+i] = array[m];
                                array[m] = t;
                            }

                            n = Math.min( (right0 - right1), (right1 - right) );
                            m = (right0-n+1)|0;
                            for( i = 0; i < n; ++i,++m ) {
                                t = array[left+i];
                                array[left+i] = array[m];
                                array[m] = t;
                            }
                            n = (left - left1);
                            m = (right1 - right);
                            if( n > 1 ) {
                                if( m > 1 ) {
                                    if( n > m ) {
                                        ++sp;
                                        stack[sp<<1] = left0;
                                        stack[(sp<<1)+1] = left0 + n - 1;
                                        left = right0 - m + 1, right = right0;
                                    } else {
                                        ++sp;
                                        stack[sp<<1] = right0 - m + 1;
                                        stack[(sp<<1)+1] = right0;
                                        left = left0, right = left0 + n - 1;
                                    }
                                } else {
                                    left = left0, right = left0 + n - 1;
                                }
                            }
                            else if( m > 1 )
                                left = right0 - m + 1, right = right0;
                            else
                                break;
                        }
                    }
                }
            },

            median: function(array, low, high) {
                var w;
                var middle=0,ll=0,hh=0,median=(low+high)>>1;
                for (;;) {
                    if (high <= low) return array[median];
                    if (high == (low + 1)) {
                        if (array[low] > array[high]) {
                            w = array[low];
                            array[low] = array[high];
                            array[high] = w;
                        }
                        return array[median];
                    }
                    middle = ((low + high) >> 1);
                    if (array[middle] > array[high]) {
                        w = array[middle];
                        array[middle] = array[high];
                        array[high] = w;
                    }
                    if (array[low] > array[high]) {
                        w = array[low];
                        array[low] = array[high];
                        array[high] = w;
                    }
                    if (array[middle] > array[low]) {
                        w = array[middle];
                        array[middle] = array[low];
                        array[low] = w;
                    }
                    ll = (low + 1);
                    w = array[middle];
                    array[middle] = array[ll];
                    array[ll] = w;
                    hh = high;
                    for (;;) {
                        do ++ll; while (array[low] > array[ll]);
                        do --hh; while (array[hh] > array[low]);
                        if (hh < ll) break;
                        w = array[ll];
                        array[ll] = array[hh];
                        array[hh] = w;
                    }
                    w = array[low];
                    array[low] = array[hh];
                    array[hh] = w;
                    if (hh <= median)
                        low = ll;
                    else if (hh >= median)
                        high = (hh - 1);
                }
                return 0;
            }
        };

    })();

    global.math = math;

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 *
 */

(function(global) {
    "use strict";
    //

    var matmath = (function() {
        
        return {
            identity: function(M, value) {
                if (typeof value === "undefined") { value=1; }
                var src=M.data;
                var rows=M.rows, cols=M.cols, cols_1=(cols+1)|0;
                var len = rows * cols;
                var k = len;
                while(--len >= 0) src[len] = 0.0;
                len = k;
                k = 0;
                while(k < len)  {
                    src[k] = value;
                    k = k + cols_1;
                }
            },

            transpose: function(At, A) {
                var i=0,j=0,nrows=A.rows,ncols=A.cols;
                var Ai=0,Ati=0,pAt=0;
                var ad=A.data,atd=At.data;

                for (; i < nrows; Ati += 1, Ai += ncols, i++) {
                    pAt = Ati;
                    for (j = 0; j < ncols; pAt += nrows, j++) atd[pAt] = ad[Ai+j];
                }
            },

            // C = A * B
            multiply: function(C, A, B) {
                var i=0,j=0,k=0;
                var Ap=0,pA=0,pB=0,p_B=0,Cp=0;
                var ncols=A.cols,nrows=A.rows,mcols=B.cols;
                var ad=A.data,bd=B.data,cd=C.data;
                var sum=0.0;

                for (; i < nrows; Ap += ncols, i++) {
                    for (p_B = 0, j = 0; j < mcols; Cp++, p_B++, j++) {
                        pB = p_B;
                        pA = Ap;
                        sum = 0.0;
                        for (k = 0; k < ncols; pA++, pB += mcols, k++) {
                            sum += ad[pA] * bd[pB];
                        }
                        cd[Cp] = sum;
                    }
                }
            },

            // C = A * B'
            multiply_ABt: function(C, A, B) {
                var i=0,j=0,k=0;
                var Ap=0,pA=0,pB=0,Cp=0;
                var ncols=A.cols,nrows=A.rows,mrows=B.rows;
                var ad=A.data,bd=B.data,cd=C.data;
                var sum=0.0;

                for (; i < nrows; Ap += ncols, i++) {
                    for (pB = 0, j = 0; j < mrows; Cp++, j++) {
                        pA = Ap;
                        sum = 0.0;
                        for (k = 0; k < ncols; pA++, pB++, k++) {
                            sum += ad[pA] * bd[pB];
                        }
                        cd[Cp] = sum;
                    }
                }
            },

            // C = A' * B
            multiply_AtB: function(C, A, B) {
                var i=0,j=0,k=0;
                var Ap=0,pA=0,pB=0,p_B=0,Cp=0;
                var ncols=A.cols,nrows=A.rows,mcols=B.cols;
                var ad=A.data,bd=B.data,cd=C.data;
                var sum=0.0;

                for (; i < ncols; Ap++, i++) {
                    for (p_B = 0, j = 0; j < mcols; Cp++, p_B++, j++) {
                        pB = p_B;
                        pA = Ap;
                        sum = 0.0;
                        for (k = 0; k < nrows; pA += ncols, pB += mcols, k++) {
                            sum += ad[pA] * bd[pB];
                        }
                        cd[Cp] = sum;
                    }
                }
            },

            // C = A * A'
            multiply_AAt: function(C, A) {
                var i=0,j=0,k=0;
                var pCdiag=0,p_A=0,pA=0,pB=0,pC=0,pCt=0;
                var ncols=A.cols,nrows=A.rows;
                var ad=A.data,cd=C.data;
                var sum=0.0;

                for (; i < nrows; pCdiag += nrows + 1, p_A = pA, i++) {
                    pC = pCdiag;
                    pCt = pCdiag;
                    pB = p_A; 
                    for (j = i; j < nrows; pC++, pCt += nrows, j++) {
                        pA = p_A;
                        sum = 0.0;
                        for (k = 0; k < ncols; k++) {
                            sum += ad[pA++] * ad[pB++];
                        }
                        cd[pC] = sum
                        cd[pCt] = sum;
                    }
                }
            },

            // C = A' * A
            multiply_AtA: function(C, A) {
                var i=0,j=0,k=0;
                var p_A=0,pA=0,pB=0,p_C=0,pC=0,p_CC=0;
                var ncols=A.cols,nrows=A.rows;
                var ad=A.data,cd=C.data;
                var sum=0.0;

                for (; i < ncols; p_C += ncols, i++) {
                    p_A = i;
                    p_CC = p_C + i;
                    pC = p_CC;
                    for (j = i; j < ncols; pC++, p_CC += ncols, j++) {
                        pA = p_A;
                        pB = j;
                        sum = 0.0;
                        for (k = 0; k < nrows; pA += ncols, pB += ncols, k++) {
                            sum += ad[pA] * ad[pB];
                        }
                        cd[pC] = sum
                        cd[p_CC] = sum;
                    }
                }
            },

            // various small matrix operations
            identity_3x3: function(M, value) {
                if (typeof value === "undefined") { value=1; }
                var dt=M.data;
                dt[0] = dt[4] = dt[8] = value;
                dt[1] = dt[2] = dt[3] = 0;
                dt[5] = dt[6] = dt[7] = 0;
            },

            invert_3x3: function(from, to) {
                var A = from.data, invA = to.data;
                var t1 = A[4];
                var t2 = A[8];
                var t4 = A[5];
                var t5 = A[7];
                var t8 = A[0];

                var t9 = t8*t1;
                var t11 = t8*t4;
                var t13 = A[3];
                var t14 = A[1];
                var t15 = t13*t14;
                var t17 = A[2];
                var t18 = t13*t17;
                var t20 = A[6];
                var t21 = t20*t14;
                var t23 = t20*t17;
                var t26 = 1.0/(t9*t2-t11*t5-t15*t2+t18*t5+t21*t4-t23*t1);
                invA[0] = (t1*t2-t4*t5)*t26;
                invA[1] = -(t14*t2-t17*t5)*t26;
                invA[2] = -(-t14*t4+t17*t1)*t26;
                invA[3] = -(t13*t2-t4*t20)*t26;
                invA[4] = (t8*t2-t23)*t26;
                invA[5] = -(t11-t18)*t26;
                invA[6] = -(-t13*t5+t1*t20)*t26;
                invA[7] = -(t8*t5-t21)*t26;
                invA[8] = (t9-t15)*t26;
            },
            // C = A * B
            multiply_3x3: function(C, A, B) {
                var Cd=C.data, Ad=A.data, Bd=B.data;
                var m1_0 = Ad[0], m1_1 = Ad[1], m1_2 = Ad[2];
                var m1_3 = Ad[3], m1_4 = Ad[4], m1_5 = Ad[5];
                var m1_6 = Ad[6], m1_7 = Ad[7], m1_8 = Ad[8];

                var m2_0 = Bd[0], m2_1 = Bd[1], m2_2 = Bd[2];
                var m2_3 = Bd[3], m2_4 = Bd[4], m2_5 = Bd[5];
                var m2_6 = Bd[6], m2_7 = Bd[7], m2_8 = Bd[8];

                Cd[0] = m1_0 * m2_0 + m1_1 * m2_3 + m1_2 * m2_6;
                Cd[1] = m1_0 * m2_1 + m1_1 * m2_4 + m1_2 * m2_7;
                Cd[2] = m1_0 * m2_2 + m1_1 * m2_5 + m1_2 * m2_8;
                Cd[3] = m1_3 * m2_0 + m1_4 * m2_3 + m1_5 * m2_6;
                Cd[4] = m1_3 * m2_1 + m1_4 * m2_4 + m1_5 * m2_7;
                Cd[5] = m1_3 * m2_2 + m1_4 * m2_5 + m1_5 * m2_8;
                Cd[6] = m1_6 * m2_0 + m1_7 * m2_3 + m1_8 * m2_6;
                Cd[7] = m1_6 * m2_1 + m1_7 * m2_4 + m1_8 * m2_7;
                Cd[8] = m1_6 * m2_2 + m1_7 * m2_5 + m1_8 * m2_8;
            },

            mat3x3_determinant: function(M) {
                var md=M.data;
                return  md[0] * md[4] * md[8] -
                        md[0] * md[5] * md[7] -
                        md[3] * md[1] * md[8] +
                        md[3] * md[2] * md[7] +
                        md[6] * md[1] * md[5] -
                        md[6] * md[2] * md[4];
            },

            determinant_3x3: function(M11, M12, M13, 
                                      M21, M22, M23, 
                                      M31, M32, M33) {
                return  M11 * M22 * M33 - M11 * M23 * M32 -
                          M21 * M12 * M33 + M21 * M13 * M32 +
                          M31 * M12 * M23 - M31 * M13 * M22;
            }
        };

    })();

    global.matmath = matmath;

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 *
 */

(function(global) {
    "use strict";
    //

    var linalg = (function() {

        var swap = function(A, i0, i1, t) {
            t = A[i0];
            A[i0] = A[i1];
            A[i1] = t;
        }

        var hypot = function(a, b) {
            a = Math.abs(a);
            b = Math.abs(b);
            if( a > b ) {
                b /= a;
                return a*Math.sqrt(1.0 + b*b);
            }
            if( b > 0 ) {
                a /= b;
                return b*Math.sqrt(1.0 + a*a);
            }
            return 0.0;
        }

        var JacobiImpl = function(A, astep, W, V, vstep, n) {
            var eps = jsfeat.EPSILON;
            var i=0,j=0,k=0,m=0,l=0,idx=0,_in=0,_in2=0;
            var iters=0,max_iter=n*n*30;
            var mv=0.0,val=0.0,p=0.0,y=0.0,t=0.0,s=0.0,c=0.0,a0=0.0,b0=0.0;

            var indR_buff = jsfeat.cache.get_buffer(n<<2);
            var indC_buff = jsfeat.cache.get_buffer(n<<2);
            var indR = indR_buff.i32;
            var indC = indC_buff.i32;

            if(V) {
                for(; i < n; i++) {
                    k = i*vstep;
                    for(j = 0; j < n; j++) {
                        V[k + j] = 0.0;
                    }
                    V[k + i] = 1.0;
                }
            }

            for(k = 0; k < n; k++) {
                W[k] = A[(astep + 1)*k];
                if(k < n - 1) {
                    for(m = k+1, mv = Math.abs(A[astep*k + m]), i = k+2; i < n; i++) {
                        val = Math.abs(A[astep*k+i]);
                        if(mv < val)
                            mv = val, m = i;
                    }
                    indR[k] = m;
                }
                if(k > 0) {
                    for(m = 0, mv = Math.abs(A[k]), i = 1; i < k; i++) {
                        val = Math.abs(A[astep*i+k]);
                        if(mv < val)
                            mv = val, m = i;
                    }
                    indC[k] = m;
                }
            }

            if(n > 1) for( ; iters < max_iter; iters++) {
                // find index (k,l) of pivot p
                for(k = 0, mv = Math.abs(A[indR[0]]), i = 1; i < n-1; i++) {
                    val = Math.abs(A[astep*i + indR[i]]);
                    if( mv < val )
                        mv = val, k = i;
                }
                l = indR[k];
                for(i = 1; i < n; i++) {
                    val = Math.abs(A[astep*indC[i] + i]);
                    if( mv < val )
                        mv = val, k = indC[i], l = i;
                }
                
                p = A[astep*k + l];

                if(Math.abs(p) <= eps) break;

                y = (W[l] - W[k])*0.5;
                t = Math.abs(y) + hypot(p, y);
                s = hypot(p, t);
                c = t/s;
                s = p/s; t = (p/t)*p;
                if(y < 0)
                    s = -s, t = -t;
                A[astep*k + l] = 0;
                
                W[k] -= t;
                W[l] += t;
                
                // rotate rows and columns k and l
                for (i = 0; i < k; i++) {
                    _in = (astep * i + k);
                    _in2 = (astep * i + l);
                    a0 = A[_in];
                    b0 = A[_in2];
                    A[_in] = a0 * c - b0 * s;
                    A[_in2] = a0 * s + b0 * c;
                }
                for (i = (k + 1); i < l; i++) {
                    _in = (astep * k + i);
                    _in2 = (astep * i + l);
                    a0 = A[_in];
                    b0 = A[_in2];
                    A[_in] = a0 * c - b0 * s;
                    A[_in2] = a0 * s + b0 * c;
                }
                i = l + 1;
                _in = (astep * k + i);
                _in2 = (astep * l + i);
                for (; i < n; i++, _in++, _in2++) {
                    a0 = A[_in];
                    b0 = A[_in2];
                    A[_in] = a0 * c - b0 * s;
                    A[_in2] = a0 * s + b0 * c;
                }
                
                // rotate eigenvectors
                if (V) {
                    _in = vstep * k;
                    _in2 = vstep * l;
                    for (i = 0; i < n; i++, _in++, _in2++) {
                        a0 = V[_in];
                        b0 = V[_in2];
                        V[_in] = a0 * c - b0 * s;
                        V[_in2] = a0 * s + b0 * c;
                    }
                }
                
                for(j = 0; j < 2; j++) {
                    idx = j == 0 ? k : l;
                    if(idx < n - 1) {
                        for(m = idx+1, mv = Math.abs(A[astep*idx + m]), i = idx+2; i < n; i++) {
                            val = Math.abs(A[astep*idx+i]);
                            if( mv < val )
                                mv = val, m = i;
                        }
                        indR[idx] = m;
                    }
                    if(idx > 0) {
                        for(m = 0, mv = Math.abs(A[idx]), i = 1; i < idx; i++) {
                            val = Math.abs(A[astep*i+idx]);
                            if( mv < val )
                                mv = val, m = i;
                        }
                        indC[idx] = m;
                    }
                }
            }

            // sort eigenvalues & eigenvectors
            for(k = 0; k < n-1; k++) {
                m = k;
                for(i = k+1; i < n; i++) {
                    if(W[m] < W[i])
                        m = i;
                }
                if(k != m) {
                    swap(W, m, k, mv);
                    if(V) {
                        for(i = 0; i < n; i++) {
                            swap(V, vstep*m + i, vstep*k + i, mv);
                        }
                    }
                }
            }


            jsfeat.cache.put_buffer(indR_buff);
            jsfeat.cache.put_buffer(indC_buff);
        }

        var JacobiSVDImpl = function(At, astep, _W, Vt, vstep, m, n, n1) {
            var eps = jsfeat.EPSILON * 2.0;
            var minval = jsfeat.FLT_MIN;
            var i=0,j=0,k=0,iter=0,max_iter=Math.max(m, 30);
            var Ai=0,Aj=0,Vi=0,Vj=0,changed=0;
            var c=0.0, s=0.0, t=0.0;
            var t0=0.0,t1=0.0,sd=0.0,beta=0.0,gamma=0.0,delta=0.0,a=0.0,p=0.0,b=0.0;
            var seed = 0x1234;
            var val=0.0,val0=0.0,asum=0.0;

            var W_buff = jsfeat.cache.get_buffer(n<<3);
            var W = W_buff.f64;
            
            for(; i < n; i++) {
                for(k = 0, sd = 0; k < m; k++) {
                    t = At[i*astep + k];
                    sd += t*t;
                }
                W[i] = sd;
                
                if(Vt) {
                    for(k = 0; k < n; k++) {
                        Vt[i*vstep + k] = 0;
                    }
                    Vt[i*vstep + i] = 1;
                }
            }
            
            for(; iter < max_iter; iter++) {
                changed = 0;
                
                for(i = 0; i < n-1; i++) {
                    for(j = i+1; j < n; j++) {
                        Ai = (i*astep)|0, Aj = (j*astep)|0;
                        a = W[i], p = 0, b = W[j];
                        
                        k = 2;
                        p += At[Ai]*At[Aj];
                        p += At[Ai+1]*At[Aj+1];

                        for(; k < m; k++)
                            p += At[Ai+k]*At[Aj+k];
                        
                        if(Math.abs(p) <= eps*Math.sqrt(a*b)) continue;
                        
                        p *= 2.0;
                        beta = a - b, gamma = hypot(p, beta);
                        if( beta < 0 ) {
                            delta = (gamma - beta)*0.5;
                            s = Math.sqrt(delta/gamma);
                            c = (p/(gamma*s*2.0));
                        } else {
                            c = Math.sqrt((gamma + beta)/(gamma*2.0));
                            s = (p/(gamma*c*2.0));
                        }
                        
                        a=0.0, b=0.0;
                        
                        k = 2; // unroll
                        t0 = c*At[Ai] + s*At[Aj];
                        t1 = -s*At[Ai] + c*At[Aj];
                        At[Ai] = t0; At[Aj] = t1;
                        a += t0*t0; b += t1*t1;

                        t0 = c*At[Ai+1] + s*At[Aj+1];
                        t1 = -s*At[Ai+1] + c*At[Aj+1];
                        At[Ai+1] = t0; At[Aj+1] = t1;
                        a += t0*t0; b += t1*t1;

                        for( ; k < m; k++ )
                        {
                            t0 = c*At[Ai+k] + s*At[Aj+k];
                            t1 = -s*At[Ai+k] + c*At[Aj+k];
                            At[Ai+k] = t0; At[Aj+k] = t1;
                            
                            a += t0*t0; b += t1*t1;
                        }
                        
                        W[i] = a; W[j] = b;
                        
                        changed = 1;
                        
                        if(Vt) {
                            Vi = (i*vstep)|0, Vj = (j*vstep)|0;

                            k = 2;
                            t0 = c*Vt[Vi] + s*Vt[Vj];
                            t1 = -s*Vt[Vi] + c*Vt[Vj];
                            Vt[Vi] = t0; Vt[Vj] = t1;

                            t0 = c*Vt[Vi+1] + s*Vt[Vj+1];
                            t1 = -s*Vt[Vi+1] + c*Vt[Vj+1];
                            Vt[Vi+1] = t0; Vt[Vj+1] = t1;

                            for(; k < n; k++) {
                                t0 = c*Vt[Vi+k] + s*Vt[Vj+k];
                                t1 = -s*Vt[Vi+k] + c*Vt[Vj+k];
                                Vt[Vi+k] = t0; Vt[Vj+k] = t1;
                            }
                        }
                    }
                }
                if(changed == 0) break;
            }
            
            for(i = 0; i < n; i++) {
                for(k = 0, sd = 0; k < m; k++) {
                    t = At[i*astep + k];
                    sd += t*t;
                }
                W[i] = Math.sqrt(sd);
            }
            
            for(i = 0; i < n-1; i++) {
                j = i;
                for(k = i+1; k < n; k++) {
                    if(W[j] < W[k])
                        j = k;
                }
                if(i != j) {
                    swap(W, i, j, sd);
                    if(Vt) {
                        for(k = 0; k < m; k++) {
                            swap(At, i*astep + k, j*astep + k, t);
                        }
                        
                        for(k = 0; k < n; k++) {
                            swap(Vt, i*vstep + k, j*vstep + k, t);
                        }
                    }
                }
            }
            
            for(i = 0; i < n; i++) {
                _W[i] = W[i];
            }
            
            if(!Vt) {
                jsfeat.cache.put_buffer(W_buff);
                return;
            }

            for(i = 0; i < n1; i++) {

                sd = i < n ? W[i] : 0;
                
                while(sd <= minval) {
                    // if we got a zero singular value, then in order to get the corresponding left singular vector
                    // we generate a random vector, project it to the previously computed left singular vectors,
                    // subtract the projection and normalize the difference.
                    val0 = (1.0/m);
                    for(k = 0; k < m; k++) {
                        seed = (seed * 214013 + 2531011);
                        val = (((seed >> 16) & 0x7fff) & 256) != 0 ? val0 : -val0;
                        At[i*astep + k] = val;
                    }
                    for(iter = 0; iter < 2; iter++) {
                        for(j = 0; j < i; j++) {
                            sd = 0;
                            for(k = 0; k < m; k++) {
                                sd += At[i*astep + k]*At[j*astep + k];
                            }
                            asum = 0.0;
                            for(k = 0; k < m; k++) {
                                t = (At[i*astep + k] - sd*At[j*astep + k]);
                                At[i*astep + k] = t;
                                asum += Math.abs(t);
                            }
                            asum = asum ? 1.0/asum : 0;
                            for(k = 0; k < m; k++) {
                                At[i*astep + k] *= asum;
                            }
                        }
                    }
                    sd = 0;
                    for(k = 0; k < m; k++) {
                        t = At[i*astep + k];
                        sd += t*t;
                    }
                    sd = Math.sqrt(sd);
                }
                
                s = (1.0/sd);
                for(k = 0; k < m; k++) {
                    At[i*astep + k] *= s;
                }
            }

            jsfeat.cache.put_buffer(W_buff);
        }
        
        return {

            lu_solve: function(A, B) {
                var i=0,j=0,k=0,p=1,astep=A.cols;
                var ad=A.data, bd=B.data;
                var t,alpha,d,s;

                for(i = 0; i < astep; i++) {
                    k = i;                    
                    for(j = i+1; j < astep; j++) {
                        if(Math.abs(ad[j*astep + i]) > Math.abs(ad[k*astep+i])) {
                            k = j;
                        }
                    }
                    
                    if(Math.abs(ad[k*astep+i]) < jsfeat.EPSILON) {
                        return 0; // FAILED
                    }
                    
                    if(k != i) {
                        for(j = i; j < astep; j++ ) {
                            swap(ad, i*astep+j, k*astep+j, t);
                        }
                        
                        swap(bd, i, k, t);
                        p = -p;
                    }
                    
                    d = -1.0/ad[i*astep+i];
                    
                    for(j = i+1; j < astep; j++) {
                        alpha = ad[j*astep+i]*d;
                        
                        for(k = i+1; k < astep; k++) {
                            ad[j*astep+k] += alpha*ad[i*astep+k];
                        }
                        
                        bd[j] += alpha*bd[i];
                    }
                    
                    ad[i*astep+i] = -d;
                }
                
                for(i = astep-1; i >= 0; i--) {
                    s = bd[i];
                    for(k = i+1; k < astep; k++) {
                        s -= ad[i*astep+k]*bd[k];
                    }
                    bd[i] = s*ad[i*astep+i];
                }

                return 1; // OK
            },

            cholesky_solve: function(A, B) {
                var col=0,row=0,col2=0,cs=0,rs=0,i=0,j=0;
                var size = A.cols;
                var ad=A.data, bd=B.data;
                var val,inv_diag;

                for (col = 0; col < size; col++) {
                    inv_diag = 1.0;
                    cs = (col * size);
                    rs = cs;
                    for (row = col; row < size; row++)
                    {
                        // correct for the parts of cholesky already computed
                        val = ad[(rs+col)];
                        for (col2 = 0; col2 < col; col2++) {
                            val -= ad[(col2*size+col)] * ad[(rs+col2)];
                        }
                        if (row == col) {
                            // this is the diagonal element so don't divide
                            ad[(rs+col)] = val;
                            if(val == 0) {
                                return 0;
                            }
                            inv_diag = 1.0 / val;
                        } else {
                            // cache the value without division in the upper half
                            ad[(cs+row)] = val;
                            // divide my the diagonal element for all others
                            ad[(rs+col)] = val * inv_diag;
                        }
                        rs = (rs + size);
                    }
                }

                // first backsub through L
                cs = 0;
                for (i = 0; i < size; i++) {
                    val = bd[i];
                    for (j = 0; j < i; j++) {
                        val -= ad[(cs+j)] * bd[j];
                    }
                    bd[i] = val;
                    cs = (cs + size);
                }
                // backsub through diagonal
                cs = 0;
                for (i = 0; i < size; i++) {
                    bd[i] /= ad[(cs + i)];
                    cs = (cs + size);
                }
                // backsub through L Transpose
                i = (size-1);
                for (; i >= 0; i--) {
                    val = bd[i];
                    j = (i + 1);
                    cs = (j * size);
                    for (; j < size; j++) {
                        val -= ad[(cs + i)] * bd[j];
                        cs = (cs + size);
                    }
                    bd[i] = val;
                }

                return 1;
            },

            svd_decompose: function(A, W, U, V, options) {
                if (typeof options === "undefined") { options = 0; };
                var at=0,i=0,j=0,_m=A.rows,_n=A.cols,m=_m,n=_n;
                var dt = A.type | jsfeat.C1_t; // we only work with single channel

                if(m < n) {
                    at = 1;
                    i = m;
                    m = n;
                    n = i;
                }

                var a_buff = jsfeat.cache.get_buffer((m*m)<<3);
                var w_buff = jsfeat.cache.get_buffer(n<<3);
                var v_buff = jsfeat.cache.get_buffer((n*n)<<3);

                var a_mt = new jsfeat.matrix_t(m, m, dt, a_buff.data);
                var w_mt = new jsfeat.matrix_t(1, n, dt, w_buff.data);
                var v_mt = new jsfeat.matrix_t(n, n, dt, v_buff.data);

                if(at == 0) {
                    // transpose
                    jsfeat.matmath.transpose(a_mt, A);
                } else {
                    for(i = 0; i < _n*_m; i++) {
                        a_mt.data[i] = A.data[i];
                    }
                    for(; i < n*m; i++) {
                        a_mt.data[i] = 0;
                    }
                }

                JacobiSVDImpl(a_mt.data, m, w_mt.data, v_mt.data, n, m, n, m);

                if(W) {
                    for(i=0; i < n; i++) {
                        W.data[i] = w_mt.data[i];
                    }
                    for(; i < _n; i++) {
                        W.data[i] = 0;
                    }
                }

                if (at == 0) {
                    if(U && (options & jsfeat.SVD_U_T)) {
                        i = m*m;
                        while(--i >= 0) {
                            U.data[i] = a_mt.data[i];
                        }
                    } else if(U) {
                        jsfeat.matmath.transpose(U, a_mt);
                    }

                    if(V && (options & jsfeat.SVD_V_T)) {
                        i = n*n;
                        while(--i >= 0) {
                            V.data[i] = v_mt.data[i];
                        }
                    } else if(V) {
                        jsfeat.matmath.transpose(V, v_mt);
                    }
                } else {
                    if(U && (options & jsfeat.SVD_U_T)) {
                        i = n*n;
                        while(--i >= 0) {
                            U.data[i] = v_mt.data[i];
                        }
                    } else if(U) {
                        jsfeat.matmath.transpose(U, v_mt);
                    }

                    if(V && (options & jsfeat.SVD_V_T)) {
                        i = m*m;
                        while(--i >= 0) {
                            V.data[i] = a_mt.data[i];
                        }
                    } else if(V) {
                        jsfeat.matmath.transpose(V, a_mt);
                    }
                }

                jsfeat.cache.put_buffer(a_buff);
                jsfeat.cache.put_buffer(w_buff);
                jsfeat.cache.put_buffer(v_buff);

            },

            svd_solve: function(A, X, B) {
                var i=0,j=0,k=0;
                var pu=0,pv=0;
                var nrows=A.rows,ncols=A.cols;
                var sum=0.0,xsum=0.0,tol=0.0;
                var dt = A.type | jsfeat.C1_t;

                var u_buff = jsfeat.cache.get_buffer((nrows*nrows)<<3);
                var w_buff = jsfeat.cache.get_buffer(ncols<<3);
                var v_buff = jsfeat.cache.get_buffer((ncols*ncols)<<3);

                var u_mt = new jsfeat.matrix_t(nrows, nrows, dt, u_buff.data);
                var w_mt = new jsfeat.matrix_t(1, ncols, dt, w_buff.data);
                var v_mt = new jsfeat.matrix_t(ncols, ncols, dt, v_buff.data);

                var bd = B.data, ud = u_mt.data, wd = w_mt.data, vd = v_mt.data;

                this.svd_decompose(A, w_mt, u_mt, v_mt, 0);

                tol = jsfeat.EPSILON * wd[0] * ncols;

                for (; i < ncols; i++, pv += ncols) {
                    xsum = 0.0;
                    for(j = 0; j < ncols; j++) {
                        if(wd[j] > tol) {
                            for(k = 0, sum = 0.0, pu = 0; k < nrows; k++, pu += ncols) {
                                sum += ud[pu + j] * bd[k];
                            }
                            xsum += sum * vd[pv + j] / wd[j];
                        }
                    }
                    X.data[i] = xsum;
                }

                jsfeat.cache.put_buffer(u_buff);
                jsfeat.cache.put_buffer(w_buff);
                jsfeat.cache.put_buffer(v_buff);
            },

            svd_invert: function(Ai, A) {
                var i=0,j=0,k=0;
                var pu=0,pv=0,pa=0;
                var nrows=A.rows,ncols=A.cols;
                var sum=0.0,tol=0.0;
                var dt = A.type | jsfeat.C1_t;

                var u_buff = jsfeat.cache.get_buffer((nrows*nrows)<<3);
                var w_buff = jsfeat.cache.get_buffer(ncols<<3);
                var v_buff = jsfeat.cache.get_buffer((ncols*ncols)<<3);

                var u_mt = new jsfeat.matrix_t(nrows, nrows, dt, u_buff.data);
                var w_mt = new jsfeat.matrix_t(1, ncols, dt, w_buff.data);
                var v_mt = new jsfeat.matrix_t(ncols, ncols, dt, v_buff.data);

                var id = Ai.data, ud = u_mt.data, wd = w_mt.data, vd = v_mt.data;

                this.svd_decompose(A, w_mt, u_mt, v_mt, 0);

                tol = jsfeat.EPSILON * wd[0] * ncols;

                for (; i < ncols; i++, pv += ncols) {
                    for (j = 0, pu = 0; j < nrows; j++, pa++) {
                        for (k = 0, sum = 0.0; k < ncols; k++, pu++) {
                            if (wd[k] > tol) sum += vd[pv + k] * ud[pu] / wd[k];
                        }
                        id[pa] = sum;
                    }
                }

                jsfeat.cache.put_buffer(u_buff);
                jsfeat.cache.put_buffer(w_buff);
                jsfeat.cache.put_buffer(v_buff);
            },

            eigenVV: function(A, vects, vals) {
                var n=A.cols,i=n*n;
                var dt = A.type | jsfeat.C1_t;

                var a_buff = jsfeat.cache.get_buffer((n*n)<<3);
                var w_buff = jsfeat.cache.get_buffer(n<<3);
                var a_mt = new jsfeat.matrix_t(n, n, dt, a_buff.data);
                var w_mt = new jsfeat.matrix_t(1, n, dt, w_buff.data);

                while(--i >= 0) {
                    a_mt.data[i] = A.data[i];
                }

                JacobiImpl(a_mt.data, n, w_mt.data, vects ? vects.data : null, n, n);

                if(vals) {
                    while(--n >= 0) {
                        vals.data[n] = w_mt.data[n];
                    }
                }

                jsfeat.cache.put_buffer(a_buff);
                jsfeat.cache.put_buffer(w_buff);
            }

        };

    })();

    global.linalg = linalg;

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 *
 */

(function(global) {
    "use strict";
    //

    var motion_model = (function() {

    	var sqr = function(x) {
    		return x*x;
    	}

    	// does isotropic normalization
    	var iso_normalize_points = function(from, to, T0, T1, count) {
			var i=0;
		    var cx0=0.0, cy0=0.0, d0=0.0, s0=0.0;
		    var cx1=0.0, cy1=0.0, d1=0.0, s1=0.0;
		    var dx=0.0,dy=0.0;

		    for (; i < count; ++i) {
		        cx0 += from[i].x;
		        cy0 += from[i].y;
		        cx1 += to[i].x;
		        cy1 += to[i].y;
		    }

		    cx0 /= count; cy0 /= count;
		    cx1 /= count; cy1 /= count;

		    for (i = 0; i < count; ++i) {
		        dx = from[i].x - cx0;
		        dy = from[i].y - cy0;
		        d0 += Math.sqrt(dx*dx + dy*dy);
		        dx = to[i].x - cx1;
		        dy = to[i].y - cy1;
		        d1 += Math.sqrt(dx*dx + dy*dy);
		    }

		    d0 /= count; d1 /= count;

		    s0 = Math.SQRT2 / d0; s1 = Math.SQRT2 / d1;

		    T0[0] = T0[4] = s0;
		    T0[2] = -cx0*s0;
		    T0[5] = -cy0*s0;
		    T0[1] = T0[3] = T0[6] = T0[7] = 0.0;
		    T0[8] = 1.0;

		    T1[0] = T1[4] = s1;
		    T1[2] = -cx1*s1;
		    T1[5] = -cy1*s1;
		    T1[1] = T1[3] = T1[6] = T1[7] = 0.0;
		    T1[8] = 1.0;
		}

		var have_collinear_points = function(points, count) {
		    var j=0,k=0,i=(count-1)|0;
		    var dx1=0.0,dy1=0.0,dx2=0.0,dy2=0.0;

		    // check that the i-th selected point does not belong
		    // to a line connecting some previously selected points
		    for(; j < i; ++j) {
		        dx1 = points[j].x - points[i].x;
		        dy1 = points[j].y - points[i].y;
		        for(k = 0; k < j; ++k) {
		            dx2 = points[k].x - points[i].x;
		            dy2 = points[k].y - points[i].y;
		            if( Math.abs(dx2*dy1 - dy2*dx1) <= jsfeat.EPSILON*(Math.abs(dx1) + Math.abs(dy1) + Math.abs(dx2) + Math.abs(dy2)))
		                return true;
		        }
		    }
		    return false;
		}

		var T0 = new jsfeat.matrix_t(3, 3, jsfeat.F32_t|jsfeat.C1_t);
    	var T1 = new jsfeat.matrix_t(3, 3, jsfeat.F32_t|jsfeat.C1_t);
    	var AtA = new jsfeat.matrix_t(6, 6, jsfeat.F32_t|jsfeat.C1_t);
    	var AtB = new jsfeat.matrix_t(6, 1, jsfeat.F32_t|jsfeat.C1_t);
    	
    	var affine2d = (function () {

	        function affine2d() {
	        	// empty constructor
	        }

	        affine2d.prototype.run = function(from, to, model, count) {
	        	var i=0,j=0;
	        	var dt=model.type|jsfeat.C1_t;
	        	var md=model.data, t0d=T0.data, t1d=T1.data;
	        	var pt0,pt1,px=0.0,py=0.0;

	            iso_normalize_points(from, to, t0d, t1d, count);

	            var a_buff = jsfeat.cache.get_buffer((2*count*6)<<3);
                var b_buff = jsfeat.cache.get_buffer((2*count)<<3);

                var a_mt = new jsfeat.matrix_t(6, 2*count, dt, a_buff.data);
                var b_mt = new jsfeat.matrix_t(1, 2*count, dt, b_buff.data);
                var ad=a_mt.data, bd=b_mt.data;

			    for (; i < count; ++i) {
			    	pt0 = from[i];
			        pt1 = to[i];

			        px = t0d[0]*pt0.x + t0d[1]*pt0.y + t0d[2];
			        py = t0d[3]*pt0.x + t0d[4]*pt0.y + t0d[5];

			        j = i*2*6;
			        ad[j]=px, ad[j+1]=py, ad[j+2]=1.0, ad[j+3]=0.0, ad[j+4]=0.0, ad[j+5]=0.0;

			        j += 6;
			        ad[j]=0.0, ad[j+1]=0.0, ad[j+2]=0.0, ad[j+3]=px, ad[j+4]=py, ad[j+5]=1.0;

			        bd[i<<1] = t1d[0]*pt1.x + t1d[1]*pt1.y + t1d[2];
			        bd[(i<<1)+1] = t1d[3]*pt1.x + t1d[4]*pt1.y + t1d[5];
			    }

			    jsfeat.matmath.multiply_AtA(AtA, a_mt);
			    jsfeat.matmath.multiply_AtB(AtB, a_mt, b_mt);

			    jsfeat.linalg.lu_solve(AtA, AtB);

			    md[0] = AtB.data[0], md[1]=AtB.data[1], md[2]=AtB.data[2];
			    md[3] = AtB.data[3], md[4]=AtB.data[4], md[5]=AtB.data[5];
			    md[6] = 0.0, md[7] = 0.0, md[8] = 1.0; // fill last row

			    // denormalize
			    jsfeat.matmath.invert_3x3(T1, T1);
			    jsfeat.matmath.multiply_3x3(model, T1, model);
			    jsfeat.matmath.multiply_3x3(model, model, T0);

			    // free buffer
			    jsfeat.cache.put_buffer(a_buff);
			    jsfeat.cache.put_buffer(b_buff);

			    return 1;
	        }

	        affine2d.prototype.error = function(from, to, model, err, count) {
	        	var i=0;
	        	var pt0,pt1;
	        	var m=model.data;

			    for (; i < count; ++i) {
			        pt0 = from[i];
			        pt1 = to[i];

			        err[i] = sqr(pt1.x - m[0]*pt0.x - m[1]*pt0.y - m[2]) +
			                 sqr(pt1.y - m[3]*pt0.x - m[4]*pt0.y - m[5]);
			    }
	        }

	        affine2d.prototype.check_subset = function(from, to, count) {
	            return true; // all good
	        }

	        return affine2d;
	    })();

	    var mLtL = new jsfeat.matrix_t(9, 9, jsfeat.F32_t|jsfeat.C1_t);
	    var Evec = new jsfeat.matrix_t(9, 9, jsfeat.F32_t|jsfeat.C1_t);

	    var homography2d = (function () {

	        function homography2d() {
	        	// empty constructor
	        	//this.T0 = new jsfeat.matrix_t(3, 3, jsfeat.F32_t|jsfeat.C1_t);
	        	//this.T1 = new jsfeat.matrix_t(3, 3, jsfeat.F32_t|jsfeat.C1_t);
	        	//this.mLtL = new jsfeat.matrix_t(9, 9, jsfeat.F32_t|jsfeat.C1_t);
	        	//this.Evec = new jsfeat.matrix_t(9, 9, jsfeat.F32_t|jsfeat.C1_t);
	        }

	        homography2d.prototype.run = function(from, to, model, count) {
	        	var i=0,j=0;
	        	var md=model.data, t0d=T0.data, t1d=T1.data;
	        	var LtL=mLtL.data, evd=Evec.data;
	        	var x=0.0,y=0.0,X=0.0,Y=0.0;

			    // norm
				var smx=0.0, smy=0.0, cmx=0.0, cmy=0.0, sMx=0.0, sMy=0.0, cMx=0.0, cMy=0.0;

				for(; i < count; ++i) {
				    cmx += to[i].x;
				    cmy += to[i].y;
				    cMx += from[i].x;
				    cMy += from[i].y;
				}

			    cmx /= count; cmy /= count;
			    cMx /= count; cMy /= count;

			    for(i = 0; i < count; ++i)
			    {
				    smx += Math.abs(to[i].x - cmx);
				    smy += Math.abs(to[i].y - cmy);
				    sMx += Math.abs(from[i].x - cMx);
				    sMy += Math.abs(from[i].y - cMy);
				}

			    if( Math.abs(smx) < jsfeat.EPSILON 
			    	|| Math.abs(smy) < jsfeat.EPSILON 
			    	|| Math.abs(sMx) < jsfeat.EPSILON 
			    	|| Math.abs(sMy) < jsfeat.EPSILON ) return 0;

			    smx = count/smx; smy = count/smy;
			    sMx = count/sMx; sMy = count/sMy;

			    t0d[0] = sMx; 	t0d[1] = 0; 	t0d[2] = -cMx*sMx; 
			    t0d[3] = 0; 	t0d[4] = sMy; 	t0d[5] = -cMy*sMy; 
			    t0d[6] = 0; 	t0d[7] = 0; 	t0d[8] = 1;

				t1d[0] = 1.0/smx; 	t1d[1] = 0; 		t1d[2] = cmx;
				t1d[3] = 0; 		t1d[4] = 1.0/smy; 	t1d[5] = cmy;
				t1d[6] = 0; 		t1d[7] = 0; 		t1d[8] = 1;
				//

				// construct system
				i = 81;
				while(--i >= 0) {
					LtL[i] = 0.0;
				}
				for(i = 0; i < count; ++i) {
					x = (to[i].x - cmx) * smx;
					y = (to[i].y - cmy) * smy;
					X = (from[i].x - cMx) * sMx;
					Y = (from[i].y - cMy) * sMy;

					LtL[0] += X*X;
					LtL[1] += X*Y;
					LtL[2] += X;

					LtL[6] += X*-x*X;
					LtL[7] += X*-x*Y;
					LtL[8] += X*-x;
					LtL[10] += Y*Y;
					LtL[11] += Y;

					LtL[15] += Y*-x*X;
					LtL[16] += Y*-x*Y;
					LtL[17] += Y*-x;
					LtL[20] += 1.0;

					LtL[24] += -x*X;
					LtL[25] += -x*Y;
					LtL[26] += -x;
					LtL[30] += X*X;
					LtL[31] += X*Y;
					LtL[32] += X;
					LtL[33] += X*-y*X;
					LtL[34] += X*-y*Y;
					LtL[35] += X*-y;
					LtL[40] += Y*Y;
					LtL[41] += Y;
					LtL[42] += Y*-y*X;
					LtL[43] += Y*-y*Y;
					LtL[44] += Y*-y;
					LtL[50] += 1.0;
					LtL[51] += -y*X;
					LtL[52] += -y*Y;
					LtL[53] += -y;
					LtL[60] += -x*X*-x*X + -y*X*-y*X;
					LtL[61] += -x*X*-x*Y + -y*X*-y*Y;
					LtL[62] += -x*X*-x + -y*X*-y;
					LtL[70] += -x*Y*-x*Y + -y*Y*-y*Y;
					LtL[71] += -x*Y*-x + -y*Y*-y;
					LtL[80] += -x*-x + -y*-y;
				}
				//

				// symmetry
			    for(i = 0; i < 9; ++i) {
			        for(j = 0; j < i; ++j)
			            LtL[i*9+j] = LtL[j*9+i];
			    }

				jsfeat.linalg.eigenVV(mLtL, Evec);

				md[0]=evd[72], md[1]=evd[73], md[2]=evd[74];
			    md[3]=evd[75], md[4]=evd[76], md[5]=evd[77];
			    md[6]=evd[78], md[7]=evd[79], md[8]=evd[80];

				// denormalize
			    jsfeat.matmath.multiply_3x3(model, T1, model);
			    jsfeat.matmath.multiply_3x3(model, model, T0);

			    // set bottom right to 1.0
			    x = 1.0/md[8];
			    md[0] *= x; md[1] *= x; md[2] *= x;
			    md[3] *= x; md[4] *= x; md[5] *= x;
			    md[6] *= x; md[7] *= x; md[8] = 1.0;

			    return 1;
	        }

	        homography2d.prototype.error = function(from, to, model, err, count) {
	        	var i=0;
	        	var pt0,pt1,ww=0.0,dx=0.0,dy=0.0;
	        	var m=model.data;

			    for (; i < count; ++i) {
			        pt0 = from[i];
			        pt1 = to[i];

			        ww = 1.0/(m[6]*pt0.x + m[7]*pt0.y + 1.0);
			        dx = (m[0]*pt0.x + m[1]*pt0.y + m[2])*ww - pt1.x;
			        dy = (m[3]*pt0.x + m[4]*pt0.y + m[5])*ww - pt1.y;
			        err[i] = (dx*dx + dy*dy);
			    }
	        }

	        homography2d.prototype.check_subset = function(from, to, count) {
	        	// seems to reject good subsets actually
	        	//if( have_collinear_points(from, count) || have_collinear_points(to, count) ) {
        			//return false;
        		//}
        		if( count == 4 ) {
			        var negative = 0;

			        var fp0=from[0],fp1=from[1],fp2=from[2],fp3=from[3];
			        var tp0=to[0],tp1=to[1],tp2=to[2],tp3=to[3];

			        // set1
			        var A11=fp0.x, A12=fp0.y, A13=1.0;
			        var A21=fp1.x, A22=fp1.y, A23=1.0;
			        var A31=fp2.x, A32=fp2.y, A33=1.0;

			        var B11=tp0.x, B12=tp0.y, B13=1.0;
			        var B21=tp1.x, B22=tp1.y, B23=1.0;
			        var B31=tp2.x, B32=tp2.y, B33=1.0;

			        var detA = jsfeat.matmath.determinant_3x3(A11,A12,A13, A21,A22,A23, A31,A32,A33);
					var detB = jsfeat.matmath.determinant_3x3(B11,B12,B13, B21,B22,B23, B31,B32,B33);

					if(detA*detB < 0) negative++;

					// set2
					A11=fp1.x, A12=fp1.y;
			        A21=fp2.x, A22=fp2.y;
			        A31=fp3.x, A32=fp3.y;

			        B11=tp1.x, B12=tp1.y;
			        B21=tp2.x, B22=tp2.y;
			        B31=tp3.x, B32=tp3.y;

			        detA = jsfeat.matmath.determinant_3x3(A11,A12,A13, A21,A22,A23, A31,A32,A33);
					detB = jsfeat.matmath.determinant_3x3(B11,B12,B13, B21,B22,B23, B31,B32,B33);

					if(detA*detB < 0) negative++;

					// set3
					A11=fp0.x, A12=fp0.y;
			        A21=fp2.x, A22=fp2.y;
			        A31=fp3.x, A32=fp3.y;

			        B11=tp0.x, B12=tp0.y;
			        B21=tp2.x, B22=tp2.y;
			        B31=tp3.x, B32=tp3.y;

			        detA = jsfeat.matmath.determinant_3x3(A11,A12,A13, A21,A22,A23, A31,A32,A33);
					detB = jsfeat.matmath.determinant_3x3(B11,B12,B13, B21,B22,B23, B31,B32,B33);

					if(detA*detB < 0) negative++;

					// set4
					A11=fp0.x, A12=fp0.y;
			        A21=fp1.x, A22=fp1.y;
			        A31=fp3.x, A32=fp3.y;

			        B11=tp0.x, B12=tp0.y;
			        B21=tp1.x, B22=tp1.y;
			        B31=tp3.x, B32=tp3.y;

			        detA = jsfeat.matmath.determinant_3x3(A11,A12,A13, A21,A22,A23, A31,A32,A33);
					detB = jsfeat.matmath.determinant_3x3(B11,B12,B13, B21,B22,B23, B31,B32,B33);

					if(detA*detB < 0) negative++;

			        if(negative != 0 && negative != 4) {
			        	return false;
			        }
			    }
	            return true; // all good
	        }

	        return homography2d;
	    })();

	    return {

    		affine2d:affine2d,
    		homography2d:homography2d

    	};

    })();

    var ransac_params_t = (function () {
        function ransac_params_t(size, thresh, eps, prob) {
            if (typeof size === "undefined") { size=0; }
            if (typeof thresh === "undefined") { thresh=0.5; }
            if (typeof eps === "undefined") { eps=0.5; }
            if (typeof prob === "undefined") { prob=0.99; }

            this.size = size;
            this.thresh = thresh;
            this.eps = eps;
            this.prob = prob;
        };
        ransac_params_t.prototype.update_iters = function(_eps, max_iters) {
	        var num = Math.log(1 - this.prob);
	        var denom = Math.log(1 - Math.pow(1 - _eps, this.size));
	        return (denom >= 0 || -num >= max_iters*(-denom) ? max_iters : Math.round(num/denom))|0;
        };
        return ransac_params_t;
    })();

    var motion_estimator = (function() {

    	var get_subset = function(kernel, from, to, need_cnt, max_cnt, from_sub, to_sub) {
    		var max_try = 1000;
    		var indices = [];
		    var i=0, j=0, ssiter=0, idx_i=0, ok=false;
		    for(; ssiter < max_try; ++ssiter)  {
		        i = 0;
		        for (; i < need_cnt && ssiter < max_try;) {
		            ok = false;
		            idx_i = 0;
		            while (!ok) {
		                ok = true;
		                idx_i = indices[i] = Math.floor(Math.random() * max_cnt)|0;
		                for (j = 0; j < i; ++j) {
		                    if (idx_i == indices[j])
		                    { ok = false; break; }
		                }
		            }
		            from_sub[i] = from[idx_i];
		            to_sub[i] = to[idx_i];
		            if( !kernel.check_subset( from_sub, to_sub, i+1 ) ) {
		                ssiter++;
		                continue;
		            }
		            ++i;
		        }
		        break;
		    }

		    return (i == need_cnt && ssiter < max_try);
    	}

    	var find_inliers = function(kernel, model, from, to, count, thresh, err, mask) {
    		var numinliers = 0, i=0, f=0;
    		var t = thresh*thresh;

    		kernel.error(from, to, model, err, count);

		    for(; i < count; ++i) {
		        f = err[i] <= t;
		        mask[i] = f;
		        numinliers += f;
		    }
		    return numinliers;
    	}

    	return {

    		ransac: function(params, kernel, from, to, count, model, mask, max_iters) {
    			if (typeof max_iters === "undefined") { max_iters=1000; }

    			if(count < params.size) return false;

    			var model_points = params.size;
			    var niters = max_iters, iter=0;
			    var result = false;

			    var subset0 = [];
			    var subset1 = [];
			    var found = false;

			    var mc=model.cols,mr=model.rows;
                var dt = model.type | jsfeat.C1_t;

			    var m_buff = jsfeat.cache.get_buffer((mc*mr)<<3);
			    var ms_buff = jsfeat.cache.get_buffer(count);
			    var err_buff = jsfeat.cache.get_buffer(count<<2);
			    var M = new jsfeat.matrix_t(mc, mr, dt, m_buff.data);
			    var curr_mask = new jsfeat.matrix_t(count, 1, jsfeat.U8C1_t, ms_buff.data);

			    var inliers_max = -1, numinliers=0;
			    var nmodels = 0;

			    var err = err_buff.f32;

			    // special case
			    if(count == model_points) {
			        if(kernel.run(from, to, M, count) <= 0) {
			        	jsfeat.cache.put_buffer(m_buff);
			        	jsfeat.cache.put_buffer(ms_buff);
			        	jsfeat.cache.put_buffer(err_buff);
			        	return false;
			        }

			        M.copy_to(model);
			        if(mask) {
			        	while(--count >= 0) {
			        		mask.data[count] = 1;
			        	}
			        }
			        jsfeat.cache.put_buffer(m_buff);
			        jsfeat.cache.put_buffer(ms_buff);
			        jsfeat.cache.put_buffer(err_buff);
			        return true;
			    }

			    for (; iter < niters; ++iter) {
			        // generate subset
			        found = get_subset(kernel, from, to, model_points, count, subset0, subset1);
			        if(!found) {
			            if(iter == 0) {
			            	jsfeat.cache.put_buffer(m_buff);
			            	jsfeat.cache.put_buffer(ms_buff);
			            	jsfeat.cache.put_buffer(err_buff);
			                return false;
			            }
			            break;
			        }

			        nmodels = kernel.run( subset0, subset1, M, model_points );
			        if(nmodels <= 0)
			            continue;

			        // TODO handle multimodel output

			        numinliers = find_inliers(kernel, M, from, to, count, params.thresh, err, curr_mask.data);

			        if( numinliers > Math.max(inliers_max, model_points-1) ) {
			            M.copy_to(model);
			            inliers_max = numinliers;
			            if(mask) curr_mask.copy_to(mask);
			            niters = params.update_iters((count - numinliers)/count, niters);
			            result = true;
			        }
			    }

			    jsfeat.cache.put_buffer(m_buff);
			    jsfeat.cache.put_buffer(ms_buff);
			    jsfeat.cache.put_buffer(err_buff);

			    return result;
    		},

    		lmeds: function(params, kernel, from, to, count, model, mask, max_iters) {
    			if (typeof max_iters === "undefined") { max_iters=1000; }

    			if(count < params.size) return false;

    			var model_points = params.size;
			    var niters = max_iters, iter=0;
			    var result = false;

			    var subset0 = [];
			    var subset1 = [];
			    var found = false;

			    var mc=model.cols,mr=model.rows;
                var dt = model.type | jsfeat.C1_t;

			    var m_buff = jsfeat.cache.get_buffer((mc*mr)<<3);
			    var ms_buff = jsfeat.cache.get_buffer(count);
			    var err_buff = jsfeat.cache.get_buffer(count<<2);
			    var M = new jsfeat.matrix_t(mc, mr, dt, m_buff.data);
			    var curr_mask = new jsfeat.matrix_t(count, 1, jsfeat.U8_t|jsfeat.C1_t, ms_buff.data);

			    var numinliers=0;
			    var nmodels = 0;

			    var err = err_buff.f32;
			    var min_median = 1000000000.0, sigma=0.0, median=0.0;

			    params.eps = 0.45;
			    niters = params.update_iters(params.eps, niters);

			    // special case
			    if(count == model_points) {
			        if(kernel.run(from, to, M, count) <= 0) {
			        	jsfeat.cache.put_buffer(m_buff);
			        	jsfeat.cache.put_buffer(ms_buff);
			        	jsfeat.cache.put_buffer(err_buff);
			        	return false;
			        }

			        M.copy_to(model);
			        if(mask) {
			        	while(--count >= 0) {
			        		mask.data[count] = 1;
			        	}
			        }
			        jsfeat.cache.put_buffer(m_buff);
			        jsfeat.cache.put_buffer(ms_buff);
			        jsfeat.cache.put_buffer(err_buff);
			        return true;
			    }

			    for (; iter < niters; ++iter) {
			        // generate subset
			        found = get_subset(kernel, from, to, model_points, count, subset0, subset1);
			        if(!found) {
			            if(iter == 0) {
			            	jsfeat.cache.put_buffer(m_buff);
			            	jsfeat.cache.put_buffer(ms_buff);
			            	jsfeat.cache.put_buffer(err_buff);
			                return false;
			            }
			            break;
			        }

			        nmodels = kernel.run( subset0, subset1, M, model_points );
			        if(nmodels <= 0)
			            continue;

			        // TODO handle multimodel output

			        kernel.error(from, to, M, err, count);
			        median = jsfeat.math.median(err, 0, count-1);

			        if(median < min_median) {
			            min_median = median;
			            M.copy_to(model);
			            result = true;
			        }
			    }

			    if(result) {
			        sigma = 2.5*1.4826*(1 + 5.0/(count - model_points))*Math.sqrt(min_median);
			        sigma = Math.max(sigma, 0.001);

			        numinliers = find_inliers(kernel, model, from, to, count, sigma, err, curr_mask.data);
			        if(mask) curr_mask.copy_to(mask);
			        
			        result = numinliers >= model_points;
			    }

			    jsfeat.cache.put_buffer(m_buff);
			    jsfeat.cache.put_buffer(ms_buff);
			    jsfeat.cache.put_buffer(err_buff);

			    return result;
    		}

    	};

    })();

    global.ransac_params_t = ransac_params_t;
    global.motion_model = motion_model;
    global.motion_estimator = motion_estimator;

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

(function(global) {
    "use strict";
    //

    var imgproc = (function() {

        var _resample_u8 = function(src, dst, nw, nh) {
            var xofs_count=0;
            var ch=src.channel,w=src.cols,h=src.rows;
            var src_d=src.data,dst_d=dst.data;
            var scale_x = w / nw, scale_y = h / nh;
            var inv_scale_256 = (scale_x * scale_y * 0x10000)|0;
            var dx=0,dy=0,sx=0,sy=0,sx1=0,sx2=0,i=0,k=0,fsx1=0.0,fsx2=0.0;
            var a=0,b=0,dxn=0,alpha=0,beta=0,beta1=0;

            var buf_node = jsfeat.cache.get_buffer((nw*ch)<<2);
            var sum_node = jsfeat.cache.get_buffer((nw*ch)<<2);
            var xofs_node = jsfeat.cache.get_buffer((w*2*3)<<2);

            var buf = buf_node.i32;
            var sum = sum_node.i32;
            var xofs = xofs_node.i32;

            for (; dx < nw; dx++) {
                fsx1 = dx * scale_x, fsx2 = fsx1 + scale_x;
                sx1 = (fsx1 + 1.0 - 1e-6)|0, sx2 = fsx2|0;
                sx1 = Math.min(sx1, w - 1);
                sx2 = Math.min(sx2, w - 1);

                if(sx1 > fsx1) {
                    xofs[k++] = (dx * ch)|0;
                    xofs[k++] = ((sx1 - 1)*ch)|0; 
                    xofs[k++] = ((sx1 - fsx1) * 0x100)|0;
                    xofs_count++;
                }
                for(sx = sx1; sx < sx2; sx++){
                    xofs_count++;
                    xofs[k++] = (dx * ch)|0;
                    xofs[k++] = (sx * ch)|0;
                    xofs[k++] = 256;
                }
                if(fsx2 - sx2 > 1e-3) {
                    xofs_count++;
                    xofs[k++] = (dx * ch)|0;
                    xofs[k++] = (sx2 * ch)|0;
                    xofs[k++] = ((fsx2 - sx2) * 256)|0;
                }
            }

            for (dx = 0; dx < nw * ch; dx++) {
                buf[dx] = sum[dx] = 0;
            }
            dy = 0;
            for (sy = 0; sy < h; sy++) {
                a = w * sy;
                for (k = 0; k < xofs_count; k++) {
                    dxn = xofs[k*3];
                    sx1 = xofs[k*3+1];
                    alpha = xofs[k*3+2];
                    for (i = 0; i < ch; i++) {
                        buf[dxn + i] += src_d[a+sx1+i] * alpha;
                    }
                }
                if ((dy + 1) * scale_y <= sy + 1 || sy == h - 1) {
                    beta = (Math.max(sy + 1 - (dy + 1) * scale_y, 0.0) * 256)|0;
                    beta1 = 256 - beta;
                    b = nw * dy;
                    if (beta <= 0) {
                        for (dx = 0; dx < nw * ch; dx++) {
                            dst_d[b+dx] = Math.min(Math.max((sum[dx] + buf[dx] * 256) / inv_scale_256, 0), 255);
                            sum[dx] = buf[dx] = 0;
                        }
                    } else {
                        for (dx = 0; dx < nw * ch; dx++) {
                            dst_d[b+dx] = Math.min(Math.max((sum[dx] + buf[dx] * beta1) / inv_scale_256, 0), 255);
                            sum[dx] = buf[dx] * beta;
                            buf[dx] = 0;
                        }
                    }
                    dy++;
                } else {
                    for(dx = 0; dx < nw * ch; dx++) {
                        sum[dx] += buf[dx] * 256;
                        buf[dx] = 0;
                    }
                }
            }

            jsfeat.cache.put_buffer(sum_node);
            jsfeat.cache.put_buffer(buf_node);
            jsfeat.cache.put_buffer(xofs_node);
        }

        var _resample = function(src, dst, nw, nh) {
            var xofs_count=0;
            var ch=src.channel,w=src.cols,h=src.rows;
            var src_d=src.data,dst_d=dst.data;
            var scale_x = w / nw, scale_y = h / nh;
            var scale = 1.0 / (scale_x * scale_y);
            var dx=0,dy=0,sx=0,sy=0,sx1=0,sx2=0,i=0,k=0,fsx1=0.0,fsx2=0.0;
            var a=0,b=0,dxn=0,alpha=0.0,beta=0.0,beta1=0.0;

            var buf_node = jsfeat.cache.get_buffer((nw*ch)<<2);
            var sum_node = jsfeat.cache.get_buffer((nw*ch)<<2);
            var xofs_node = jsfeat.cache.get_buffer((w*2*3)<<2);

            var buf = buf_node.f32;
            var sum = sum_node.f32;
            var xofs = xofs_node.f32;

            for (; dx < nw; dx++) {
                fsx1 = dx * scale_x, fsx2 = fsx1 + scale_x;
                sx1 = (fsx1 + 1.0 - 1e-6)|0, sx2 = fsx2|0;
                sx1 = Math.min(sx1, w - 1);
                sx2 = Math.min(sx2, w - 1);

                if(sx1 > fsx1) {
                    xofs_count++;
                    xofs[k++] = ((sx1 - 1)*ch)|0;
                    xofs[k++] = (dx * ch)|0;
                    xofs[k++] = (sx1 - fsx1) * scale;
                }
                for(sx = sx1; sx < sx2; sx++){
                    xofs_count++;
                    xofs[k++] = (sx * ch)|0;
                    xofs[k++] = (dx * ch)|0; 
                    xofs[k++] = scale;
                }
                if(fsx2 - sx2 > 1e-3) {
                    xofs_count++;
                    xofs[k++] = (sx2 * ch)|0;
                    xofs[k++] = (dx * ch)|0;
                    xofs[k++] = (fsx2 - sx2) * scale;
                }
            }

            for (dx = 0; dx < nw * ch; dx++) {
                buf[dx] = sum[dx] = 0;
            }
            dy = 0;
            for (sy = 0; sy < h; sy++) {
                a = w * sy;
                for (k = 0; k < xofs_count; k++) {
                    sx1 = xofs[k*3]|0;
                    dxn = xofs[k*3+1]|0;
                    alpha = xofs[k*3+2];
                    for (i = 0; i < ch; i++) {
                        buf[dxn + i] += src_d[a+sx1+i] * alpha;
                    }
                }
                if ((dy + 1) * scale_y <= sy + 1 || sy == h - 1) {
                    beta = Math.max(sy + 1 - (dy + 1) * scale_y, 0.0);
                    beta1 = 1.0 - beta;
                    b = nw * dy;
                    if (Math.abs(beta) < 1e-3) {
                        for (dx = 0; dx < nw * ch; dx++) {
                            dst_d[b+dx] = sum[dx] + buf[dx];
                            sum[dx] = buf[dx] = 0;
                        }
                    } else {
                        for (dx = 0; dx < nw * ch; dx++) {
                            dst_d[b+dx] = sum[dx] + buf[dx] * beta1;
                            sum[dx] = buf[dx] * beta;
                            buf[dx] = 0;
                        }
                    }
                    dy++;
                } else {
                    for(dx = 0; dx < nw * ch; dx++) {
                        sum[dx] += buf[dx]; 
                        buf[dx] = 0;
                    }
                }
            }
            jsfeat.cache.put_buffer(sum_node);
            jsfeat.cache.put_buffer(buf_node);
            jsfeat.cache.put_buffer(xofs_node);
        }

        var _convol_u8 = function(buf, src_d, dst_d, w, h, filter, kernel_size, half_kernel) {
            var i=0,j=0,k=0,sp=0,dp=0,sum=0,sum1=0,sum2=0,sum3=0,f0=filter[0],fk=0;
            var w2=w<<1,w3=w*3,w4=w<<2;
            // hor pass
            for (; i < h; ++i) { 
                sum = src_d[sp];
                for (j = 0; j < half_kernel; ++j) {
                    buf[j] = sum;
                }
                for (j = 0; j <= w-2; j+=2) {
                    buf[j + half_kernel] = src_d[sp+j];
                    buf[j + half_kernel+1] = src_d[sp+j+1];
                }
                for (; j < w; ++j) {
                    buf[j + half_kernel] = src_d[sp+j];
                }
                sum = src_d[sp+w-1];
                for (j = w; j < half_kernel + w; ++j) {
                    buf[j + half_kernel] = sum;
                }
                for (j = 0; j <= w-4; j+=4) {
                    sum = buf[j] * f0, 
                    sum1 = buf[j+1] * f0,
                    sum2 = buf[j+2] * f0,
                    sum3 = buf[j+3] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        fk = filter[k];
                        sum += buf[k + j] * fk;
                        sum1 += buf[k + j+1] * fk;
                        sum2 += buf[k + j+2] * fk;
                        sum3 += buf[k + j+3] * fk;
                    }
                    dst_d[dp+j] = Math.min(sum >> 8, 255);
                    dst_d[dp+j+1] = Math.min(sum1 >> 8, 255);
                    dst_d[dp+j+2] = Math.min(sum2 >> 8, 255);
                    dst_d[dp+j+3] = Math.min(sum3 >> 8, 255);
                }
                for (; j < w; ++j) {
                    sum = buf[j] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        sum += buf[k + j] * filter[k];
                    }
                    dst_d[dp+j] = Math.min(sum >> 8, 255);
                }
                sp += w;
                dp += w;
            }

            // vert pass
            for (i = 0; i < w; ++i) {
                sum = dst_d[i];
                for (j = 0; j < half_kernel; ++j) {
                    buf[j] = sum;
                }
                k = i;
                for (j = 0; j <= h-2; j+=2, k+=w2) {
                    buf[j+half_kernel] = dst_d[k];
                    buf[j+half_kernel+1] = dst_d[k+w];
                }
                for (; j < h; ++j, k+=w) {
                    buf[j+half_kernel] = dst_d[k];
                }
                sum = dst_d[(h-1)*w + i];
                for (j = h; j < half_kernel + h; ++j) {
                    buf[j + half_kernel] = sum;
                }
                dp = i;
                for (j = 0; j <= h-4; j+=4, dp+=w4) { 
                    sum = buf[j] * f0, 
                    sum1 = buf[j+1] * f0,
                    sum2 = buf[j+2] * f0,
                    sum3 = buf[j+3] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        fk = filter[k];
                        sum += buf[k + j] * fk;
                        sum1 += buf[k + j+1] * fk;
                        sum2 += buf[k + j+2] * fk;
                        sum3 += buf[k + j+3] * fk;
                    }
                    dst_d[dp] = Math.min(sum >> 8, 255);
                    dst_d[dp+w] = Math.min(sum1 >> 8, 255);
                    dst_d[dp+w2] = Math.min(sum2 >> 8, 255);
                    dst_d[dp+w3] = Math.min(sum3 >> 8, 255);
                }
                for (; j < h; ++j, dp+=w) {
                    sum = buf[j] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        sum += buf[k + j] * filter[k];
                    }
                    dst_d[dp] = Math.min(sum >> 8, 255);
                }
            }
        }

        var _convol = function(buf, src_d, dst_d, w, h, filter, kernel_size, half_kernel) {
            var i=0,j=0,k=0,sp=0,dp=0,sum=0.0,sum1=0.0,sum2=0.0,sum3=0.0,f0=filter[0],fk=0.0;
            var w2=w<<1,w3=w*3,w4=w<<2;
            // hor pass
            for (; i < h; ++i) { 
                sum = src_d[sp];
                for (j = 0; j < half_kernel; ++j) {
                    buf[j] = sum;
                }
                for (j = 0; j <= w-2; j+=2) {
                    buf[j + half_kernel] = src_d[sp+j];
                    buf[j + half_kernel+1] = src_d[sp+j+1];
                }
                for (; j < w; ++j) {
                    buf[j + half_kernel] = src_d[sp+j];
                }
                sum = src_d[sp+w-1];
                for (j = w; j < half_kernel + w; ++j) {
                    buf[j + half_kernel] = sum;
                }
                for (j = 0; j <= w-4; j+=4) {
                    sum = buf[j] * f0, 
                    sum1 = buf[j+1] * f0,
                    sum2 = buf[j+2] * f0,
                    sum3 = buf[j+3] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        fk = filter[k];
                        sum += buf[k + j] * fk;
                        sum1 += buf[k + j+1] * fk;
                        sum2 += buf[k + j+2] * fk;
                        sum3 += buf[k + j+3] * fk;
                    }
                    dst_d[dp+j] = sum;
                    dst_d[dp+j+1] = sum1;
                    dst_d[dp+j+2] = sum2;
                    dst_d[dp+j+3] = sum3;
                }
                for (; j < w; ++j) {
                    sum = buf[j] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        sum += buf[k + j] * filter[k];
                    }
                    dst_d[dp+j] = sum;
                }
                sp += w;
                dp += w;
            }

            // vert pass
            for (i = 0; i < w; ++i) {
                sum = dst_d[i];
                for (j = 0; j < half_kernel; ++j) {
                    buf[j] = sum;
                }
                k = i;
                for (j = 0; j <= h-2; j+=2, k+=w2) {
                    buf[j+half_kernel] = dst_d[k];
                    buf[j+half_kernel+1] = dst_d[k+w];
                }
                for (; j < h; ++j, k+=w) {
                    buf[j+half_kernel] = dst_d[k];
                }
                sum = dst_d[(h-1)*w + i];
                for (j = h; j < half_kernel + h; ++j) {
                    buf[j + half_kernel] = sum;
                }
                dp = i;
                for (j = 0; j <= h-4; j+=4, dp+=w4) { 
                    sum = buf[j] * f0, 
                    sum1 = buf[j+1] * f0,
                    sum2 = buf[j+2] * f0,
                    sum3 = buf[j+3] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        fk = filter[k];
                        sum += buf[k + j] * fk;
                        sum1 += buf[k + j+1] * fk;
                        sum2 += buf[k + j+2] * fk;
                        sum3 += buf[k + j+3] * fk;
                    }
                    dst_d[dp] = sum;
                    dst_d[dp+w] = sum1;
                    dst_d[dp+w2] = sum2;
                    dst_d[dp+w3] = sum3;
                }
                for (; j < h; ++j, dp+=w) {
                    sum = buf[j] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        sum += buf[k + j] * filter[k];
                    }
                    dst_d[dp] = sum;
                }
            }
        }

        return {
            // TODO: add support for RGB/BGR order
            // for raw arrays
            grayscale: function(src, w, h, dst, code) {
                // this is default image data representation in browser
                if (typeof code === "undefined") { code = jsfeat.COLOR_RGBA2GRAY; }
                var x=0, y=0, i=0, j=0, ir=0,jr=0;
                var coeff_r = 4899, coeff_g = 9617, coeff_b = 1868, cn = 4;

                if(code == jsfeat.COLOR_BGRA2GRAY || code == jsfeat.COLOR_BGR2GRAY) {
                    coeff_r = 1868;
                    coeff_b = 4899;
                }
                if(code == jsfeat.COLOR_RGB2GRAY || code == jsfeat.COLOR_BGR2GRAY) {
                    cn = 3;
                }
                var cn2 = cn<<1, cn3 = (cn*3)|0;

                dst.resize(w, h, 1);
                var dst_u8 = dst.data;

                for(y = 0; y < h; ++y, j+=w, i+=w*cn) {
                    for(x = 0, ir = i, jr = j; x <= w-4; x+=4, ir+=cn<<2, jr+=4) {
                        dst_u8[jr]     = (src[ir] * coeff_r + src[ir+1] * coeff_g + src[ir+2] * coeff_b + 8192) >> 14;
                        dst_u8[jr + 1] = (src[ir+cn] * coeff_r + src[ir+cn+1] * coeff_g + src[ir+cn+2] * coeff_b + 8192) >> 14;
                        dst_u8[jr + 2] = (src[ir+cn2] * coeff_r + src[ir+cn2+1] * coeff_g + src[ir+cn2+2] * coeff_b + 8192) >> 14;
                        dst_u8[jr + 3] = (src[ir+cn3] * coeff_r + src[ir+cn3+1] * coeff_g + src[ir+cn3+2] * coeff_b + 8192) >> 14;
                    }
                    for (; x < w; ++x, ++jr, ir+=cn) {
                        dst_u8[jr] = (src[ir] * coeff_r + src[ir+1] * coeff_g + src[ir+2] * coeff_b + 8192) >> 14;
                    }
                }
            },
            // derived from CCV library
            resample: function(src, dst, nw, nh) {
                var h=src.rows,w=src.cols;
                if (h > nh && w > nw) {
                    dst.resize(nw, nh, src.channel);
                    // using the fast alternative (fix point scale, 0x100 to avoid overflow)
                    if (src.type&jsfeat.U8_t && dst.type&jsfeat.U8_t && h * w / (nh * nw) < 0x100) {
                        _resample_u8(src, dst, nw, nh);
                    } else {
                        _resample(src, dst, nw, nh);
                    }
                }
            },

            box_blur_gray: function(src, dst, radius, options) {
                if (typeof options === "undefined") { options = 0; }
                var w=src.cols, h=src.rows, h2=h<<1, w2=w<<1;
                var i=0,x=0,y=0,end=0;
                var windowSize = ((radius << 1) + 1)|0;
                var radiusPlusOne = (radius + 1)|0, radiusPlus2 = (radiusPlusOne+1)|0;
                var scale = options&jsfeat.BOX_BLUR_NOSCALE ? 1 : (1.0 / (windowSize*windowSize));

                var tmp_buff = jsfeat.cache.get_buffer((w*h)<<2);

                var sum=0, dstIndex=0, srcIndex = 0, nextPixelIndex=0, previousPixelIndex=0;
                var data_i32 = tmp_buff.i32; // to prevent overflow
                var data_u8 = src.data;
                var hold=0;

                dst.resize(w, h, src.channel);

                // first pass
                // no need to scale 
                //data_u8 = src.data;
                //data_i32 = tmp;
                for (y = 0; y < h; ++y) {
                    dstIndex = y;
                    sum = radiusPlusOne * data_u8[srcIndex];

                    for(i = (srcIndex+1)|0, end=(srcIndex+radius)|0; i <= end; ++i) {
                        sum += data_u8[i];
                    }

                    nextPixelIndex = (srcIndex + radiusPlusOne)|0;
                    previousPixelIndex = srcIndex;
                    hold = data_u8[previousPixelIndex];
                    for(x = 0; x < radius; ++x, dstIndex += h) {
                        data_i32[dstIndex] = sum;
                        sum += data_u8[nextPixelIndex]- hold;
                        nextPixelIndex ++;
                    }
                    for(; x < w-radiusPlus2; x+=2, dstIndex += h2) {
                        data_i32[dstIndex] = sum;
                        sum += data_u8[nextPixelIndex]- data_u8[previousPixelIndex];

                        data_i32[dstIndex+h] = sum;
                        sum += data_u8[nextPixelIndex+1]- data_u8[previousPixelIndex+1];

                        nextPixelIndex +=2;
                        previousPixelIndex +=2;
                    }
                    for(; x < w-radiusPlusOne; ++x, dstIndex += h) {
                        data_i32[dstIndex] = sum;
                        sum += data_u8[nextPixelIndex]- data_u8[previousPixelIndex];

                        nextPixelIndex ++;
                        previousPixelIndex ++;
                    }
                    
                    hold = data_u8[nextPixelIndex-1];
                    for(; x < w; ++x, dstIndex += h) {
                        data_i32[dstIndex] = sum;

                        sum += hold- data_u8[previousPixelIndex];
                        previousPixelIndex ++;
                    }

                    srcIndex += w;
                }
                //
                // second pass
                srcIndex = 0;
                //data_i32 = tmp; // this is a transpose
                data_u8 = dst.data;

                // dont scale result
                if(scale == 1) {
                    for (y = 0; y < w; ++y) {
                        dstIndex = y;
                        sum = radiusPlusOne * data_i32[srcIndex];

                        for(i = (srcIndex+1)|0, end=(srcIndex+radius)|0; i <= end; ++i) {
                            sum += data_i32[i];
                        }

                        nextPixelIndex = srcIndex + radiusPlusOne;
                        previousPixelIndex = srcIndex;
                        hold = data_i32[previousPixelIndex];

                        for(x = 0; x < radius; ++x, dstIndex += w) {
                            data_u8[dstIndex] = sum;
                            sum += data_i32[nextPixelIndex]- hold;
                            nextPixelIndex ++;
                        }
                        for(; x < h-radiusPlus2; x+=2, dstIndex += w2) {
                            data_u8[dstIndex] = sum;
                            sum += data_i32[nextPixelIndex]- data_i32[previousPixelIndex];

                            data_u8[dstIndex+w] = sum;
                            sum += data_i32[nextPixelIndex+1]- data_i32[previousPixelIndex+1];

                            nextPixelIndex +=2;
                            previousPixelIndex +=2;
                        }
                        for(; x < h-radiusPlusOne; ++x, dstIndex += w) {
                            data_u8[dstIndex] = sum;

                            sum += data_i32[nextPixelIndex]- data_i32[previousPixelIndex];
                            nextPixelIndex ++;
                            previousPixelIndex ++;
                        }
                        hold = data_i32[nextPixelIndex-1];
                        for(; x < h; ++x, dstIndex += w) {
                            data_u8[dstIndex] = sum;

                            sum += hold- data_i32[previousPixelIndex];
                            previousPixelIndex ++;
                        }

                        srcIndex += h;
                    }
                } else {
                    for (y = 0; y < w; ++y) {
                        dstIndex = y;
                        sum = radiusPlusOne * data_i32[srcIndex];

                        for(i = (srcIndex+1)|0, end=(srcIndex+radius)|0; i <= end; ++i) {
                            sum += data_i32[i];
                        }

                        nextPixelIndex = srcIndex + radiusPlusOne;
                        previousPixelIndex = srcIndex;
                        hold = data_i32[previousPixelIndex];

                        for(x = 0; x < radius; ++x, dstIndex += w) {
                            data_u8[dstIndex] = sum*scale;
                            sum += data_i32[nextPixelIndex]- hold;
                            nextPixelIndex ++;
                        }
                        for(; x < h-radiusPlus2; x+=2, dstIndex += w2) {
                            data_u8[dstIndex] = sum*scale;
                            sum += data_i32[nextPixelIndex]- data_i32[previousPixelIndex];

                            data_u8[dstIndex+w] = sum*scale;
                            sum += data_i32[nextPixelIndex+1]- data_i32[previousPixelIndex+1];

                            nextPixelIndex +=2;
                            previousPixelIndex +=2;
                        }
                        for(; x < h-radiusPlusOne; ++x, dstIndex += w) {
                            data_u8[dstIndex] = sum*scale;

                            sum += data_i32[nextPixelIndex]- data_i32[previousPixelIndex];
                            nextPixelIndex ++;
                            previousPixelIndex ++;
                        }
                        hold = data_i32[nextPixelIndex-1];
                        for(; x < h; ++x, dstIndex += w) {
                            data_u8[dstIndex] = sum*scale;

                            sum += hold- data_i32[previousPixelIndex];
                            previousPixelIndex ++;
                        }

                        srcIndex += h;
                    }
                }

                jsfeat.cache.put_buffer(tmp_buff);
            },

            gaussian_blur: function(src, dst, kernel_size, sigma) {
                if (typeof sigma === "undefined") { sigma = 0.0; }
                if (typeof kernel_size === "undefined") { kernel_size = 0; }
                kernel_size = kernel_size == 0 ? (Math.max(1, (4.0 * sigma + 1.0 - 1e-8)) * 2 + 1)|0 : kernel_size;
                var half_kernel = kernel_size >> 1;
                var w = src.cols, h = src.rows;
                var data_type = src.type, is_u8 = data_type&jsfeat.U8_t;

                dst.resize(w, h, src.channel);

                var src_d = src.data, dst_d = dst.data;
                var buf,filter,buf_sz=(kernel_size + Math.max(h, w))|0;

                var buf_node = jsfeat.cache.get_buffer(buf_sz<<2);
                var filt_node = jsfeat.cache.get_buffer(kernel_size<<2);

                if(is_u8) {
                    buf = buf_node.i32;
                    filter = filt_node.i32;
                } else if(data_type&jsfeat.S32_t) {
                    buf = buf_node.i32;
                    filter = filt_node.f32;
                } else {
                    buf = buf_node.f32;
                    filter = filt_node.f32;
                }

                jsfeat.math.get_gaussian_kernel(kernel_size, sigma, filter, data_type);

                if(is_u8) {
                    _convol_u8(buf, src_d, dst_d, w, h, filter, kernel_size, half_kernel);
                } else {
                    _convol(buf, src_d, dst_d, w, h, filter, kernel_size, half_kernel);
                }

                jsfeat.cache.put_buffer(buf_node);
                jsfeat.cache.put_buffer(filt_node);
            },
            // assume we always need it for u8 image
            pyrdown: function(src, dst, sx, sy) {
                // this is needed for bbf
                if (typeof sx === "undefined") { sx = 0; }
                if (typeof sy === "undefined") { sy = 0; }

                var w = src.cols, h = src.rows;
                var w2 = w >> 1, h2 = h >> 1;
                var _w2 = w2 - (sx << 1), _h2 = h2 - (sy << 1);
                var x=0,y=0,sptr=sx+sy*w,sline=0,dptr=0,dline=0;

                dst.resize(w2, h2, src.channel);

                var src_d = src.data, dst_d = dst.data;

                for(y = 0; y < _h2; ++y) {
                    sline = sptr;
                    dline = dptr;
                    for(x = 0; x <= _w2-2; x+=2, dline+=2, sline += 4) {
                        dst_d[dline] = (src_d[sline] + src_d[sline+1] +
                                            src_d[sline+w] + src_d[sline+w+1] + 2) >> 2;
                        dst_d[dline+1] = (src_d[sline+2] + src_d[sline+3] +
                                            src_d[sline+w+2] + src_d[sline+w+3] + 2) >> 2;
                    }
                    for(; x < _w2; ++x, ++dline, sline += 2) {
                        dst_d[dline] = (src_d[sline] + src_d[sline+1] +
                                            src_d[sline+w] + src_d[sline+w+1] + 2) >> 2;
                    }
                    sptr += w << 1;
                    dptr += w2;
                }
            },

            // dst: [gx,gy,...]
            scharr_derivatives: function(src, dst) {
                var w = src.cols, h = src.rows;
                var dstep = w<<1,x=0,y=0,x1=0,a,b,c,d,e,f;
                var srow0=0,srow1=0,srow2=0,drow=0;
                var trow0,trow1;

                dst.resize(w, h, 2); // 2 channel output gx, gy

                var img = src.data, gxgy=dst.data;

                var buf0_node = jsfeat.cache.get_buffer((w+2)<<2);
                var buf1_node = jsfeat.cache.get_buffer((w+2)<<2);

                if(src.type&jsfeat.U8_t || src.type&jsfeat.S32_t) {
                    trow0 = buf0_node.i32;
                    trow1 = buf1_node.i32;
                } else {
                    trow0 = buf0_node.f32;
                    trow1 = buf1_node.f32;
                }

                for(; y < h; ++y, srow1+=w) {
                    srow0 = ((y > 0 ? y-1 : 1)*w)|0;
                    srow2 = ((y < h-1 ? y+1 : h-2)*w)|0;
                    drow = (y*dstep)|0;
                    // do vertical convolution
                    for(x = 0, x1 = 1; x <= w-2; x+=2, x1+=2) {
                        a = img[srow0+x], b = img[srow2+x];
                        trow0[x1] = ( (a + b)*3 + (img[srow1+x])*10 );
                        trow1[x1] = ( b - a );
                        //
                        a = img[srow0+x+1], b = img[srow2+x+1];
                        trow0[x1+1] = ( (a + b)*3 + (img[srow1+x+1])*10 );
                        trow1[x1+1] = ( b - a );
                    }
                    for(; x < w; ++x, ++x1) {
                        a = img[srow0+x], b = img[srow2+x];
                        trow0[x1] = ( (a + b)*3 + (img[srow1+x])*10 );
                        trow1[x1] = ( b - a );
                    }
                    // make border
                    x = (w + 1)|0;
                    trow0[0] = trow0[1]; trow0[x] = trow0[w];
                    trow1[0] = trow1[1]; trow1[x] = trow1[w];
                    // do horizontal convolution, interleave the results and store them
                    for(x = 0; x <= w-4; x+=4) {
                        a = trow1[x+2], b = trow1[x+1], c = trow1[x+3], d = trow1[x+4],
                        e = trow0[x+2], f = trow0[x+3];
                        gxgy[drow++] = ( e - trow0[x] );
                        gxgy[drow++] = ( (a + trow1[x])*3 + b*10 );
                        gxgy[drow++] = ( f - trow0[x+1] );
                        gxgy[drow++] = ( (c + b)*3 + a*10 );

                        gxgy[drow++] = ( (trow0[x+4] - e) );
                        gxgy[drow++] = ( ((d + a)*3 + c*10) );
                        gxgy[drow++] = ( (trow0[x+5] - f) );
                        gxgy[drow++] = ( ((trow1[x+5] + c)*3 + d*10) );
                    }
                    for(; x < w; ++x) {
                        gxgy[drow++] = ( (trow0[x+2] - trow0[x]) );
                        gxgy[drow++] = ( ((trow1[x+2] + trow1[x])*3 + trow1[x+1]*10) );
                    }
                }
                jsfeat.cache.put_buffer(buf0_node);
                jsfeat.cache.put_buffer(buf1_node);
            },

            // compute gradient using Sobel kernel [1 2 1] * [-1 0 1]^T
            // dst: [gx,gy,...]
            sobel_derivatives: function(src, dst) {
                var w = src.cols, h = src.rows;
                var dstep = w<<1,x=0,y=0,x1=0,a,b,c,d,e,f;
                var srow0=0,srow1=0,srow2=0,drow=0;
                var trow0,trow1;

                dst.resize(w, h, 2); // 2 channel output gx, gy

                var img = src.data, gxgy=dst.data;

                var buf0_node = jsfeat.cache.get_buffer((w+2)<<2);
                var buf1_node = jsfeat.cache.get_buffer((w+2)<<2);

                if(src.type&jsfeat.U8_t || src.type&jsfeat.S32_t) {
                    trow0 = buf0_node.i32;
                    trow1 = buf1_node.i32;
                } else {
                    trow0 = buf0_node.f32;
                    trow1 = buf1_node.f32;
                }

                for(; y < h; ++y, srow1+=w) {
                    srow0 = ((y > 0 ? y-1 : 1)*w)|0;
                    srow2 = ((y < h-1 ? y+1 : h-2)*w)|0;
                    drow = (y*dstep)|0;
                    // do vertical convolution
                    for(x = 0, x1 = 1; x <= w-2; x+=2, x1+=2) {
                        a = img[srow0+x], b = img[srow2+x];
                        trow0[x1] = ( (a + b) + (img[srow1+x]*2) );
                        trow1[x1] = ( b - a );
                        //
                        a = img[srow0+x+1], b = img[srow2+x+1];
                        trow0[x1+1] = ( (a + b) + (img[srow1+x+1]*2) );
                        trow1[x1+1] = ( b - a );
                    }
                    for(; x < w; ++x, ++x1) {
                        a = img[srow0+x], b = img[srow2+x];
                        trow0[x1] = ( (a + b) + (img[srow1+x]*2) );
                        trow1[x1] = ( b - a );
                    }
                    // make border
                    x = (w + 1)|0;
                    trow0[0] = trow0[1]; trow0[x] = trow0[w];
                    trow1[0] = trow1[1]; trow1[x] = trow1[w];
                    // do horizontal convolution, interleave the results and store them
                    for(x = 0; x <= w-4; x+=4) {
                        a = trow1[x+2], b = trow1[x+1], c = trow1[x+3], d = trow1[x+4],
                        e = trow0[x+2], f = trow0[x+3];
                        gxgy[drow++] = ( e - trow0[x] );
                        gxgy[drow++] = ( a + trow1[x] + b*2 );
                        gxgy[drow++] = ( f - trow0[x+1] );
                        gxgy[drow++] = ( c + b + a*2 );

                        gxgy[drow++] = ( trow0[x+4] - e );
                        gxgy[drow++] = ( d + a + c*2 );
                        gxgy[drow++] = ( trow0[x+5] - f );
                        gxgy[drow++] = ( trow1[x+5] + c + d*2 );
                    }
                    for(; x < w; ++x) {
                        gxgy[drow++] = ( trow0[x+2] - trow0[x] );
                        gxgy[drow++] = ( trow1[x+2] + trow1[x] + trow1[x+1]*2 );
                    }
                }
                jsfeat.cache.put_buffer(buf0_node);
                jsfeat.cache.put_buffer(buf1_node);
            },

            // please note: 
            // dst_(type) size should be cols = src.cols+1, rows = src.rows+1
            compute_integral_image: function(src, dst_sum, dst_sqsum, dst_tilted) {
                var w0=src.cols|0,h0=src.rows|0,src_d=src.data;
                var w1=(w0+1)|0;
                var s=0,s2=0,p=0,pup=0,i=0,j=0,v=0,k=0;

                if(dst_sum && dst_sqsum) {
                    // fill first row with zeros
                    for(; i < w1; ++i) {
                        dst_sum[i] = 0, dst_sqsum[i] = 0;
                    }
                    p = (w1+1)|0, pup = 1;
                    for(i = 0, k = 0; i < h0; ++i, ++p, ++pup) {
                        s = s2 = 0;
                        for(j = 0; j <= w0-2; j+=2, k+=2, p+=2, pup+=2) {
                            v = src_d[k];
                            s += v, s2 += v*v;
                            dst_sum[p] = dst_sum[pup] + s;
                            dst_sqsum[p] = dst_sqsum[pup] + s2;

                            v = src_d[k+1];
                            s += v, s2 += v*v;
                            dst_sum[p+1] = dst_sum[pup+1] + s;
                            dst_sqsum[p+1] = dst_sqsum[pup+1] + s2;
                        }
                        for(; j < w0; ++j, ++k, ++p, ++pup) {
                            v = src_d[k];
                            s += v, s2 += v*v;
                            dst_sum[p] = dst_sum[pup] + s;
                            dst_sqsum[p] = dst_sqsum[pup] + s2;
                        }
                    }
                } else if(dst_sum) {
                    // fill first row with zeros
                    for(; i < w1; ++i) {
                        dst_sum[i] = 0;
                    }
                    p = (w1+1)|0, pup = 1;
                    for(i = 0, k = 0; i < h0; ++i, ++p, ++pup) {
                        s = 0;
                        for(j = 0; j <= w0-2; j+=2, k+=2, p+=2, pup+=2) {
                            s += src_d[k];
                            dst_sum[p] = dst_sum[pup] + s;
                            s += src_d[k+1];
                            dst_sum[p+1] = dst_sum[pup+1] + s;
                        }
                        for(; j < w0; ++j, ++k, ++p, ++pup) {
                            s += src_d[k];
                            dst_sum[p] = dst_sum[pup] + s;
                        }
                    }
                } else if(dst_sqsum) {
                    // fill first row with zeros
                    for(; i < w1; ++i) {
                        dst_sqsum[i] = 0;
                    }
                    p = (w1+1)|0, pup = 1;
                    for(i = 0, k = 0; i < h0; ++i, ++p, ++pup) {
                        s2 = 0;
                        for(j = 0; j <= w0-2; j+=2, k+=2, p+=2, pup+=2) {
                            v = src_d[k];
                            s2 += v*v;
                            dst_sqsum[p] = dst_sqsum[pup] + s2;
                            v = src_d[k+1];
                            s2 += v*v;
                            dst_sqsum[p+1] = dst_sqsum[pup+1] + s2;
                        }
                        for(; j < w0; ++j, ++k, ++p, ++pup) {
                            v = src_d[k];
                            s2 += v*v;
                            dst_sqsum[p] = dst_sqsum[pup] + s2;
                        }
                    }
                }

                if(dst_tilted) {
                    // fill first row with zeros
                    for(i = 0; i < w1; ++i) {
                        dst_tilted[i] = 0;
                    }
                    // diagonal
                    p = (w1+1)|0, pup = 0;
                    for(i = 0, k = 0; i < h0; ++i, ++p, ++pup) {
                        for(j = 0; j <= w0-2; j+=2, k+=2, p+=2, pup+=2) {
                            dst_tilted[p] = src_d[k] + dst_tilted[pup];
                            dst_tilted[p+1] = src_d[k+1] + dst_tilted[pup+1];
                        }
                        for(; j < w0; ++j, ++k, ++p, ++pup) {
                            dst_tilted[p] = src_d[k] + dst_tilted[pup];
                        }
                    }
                    // diagonal
                    p = (w1+w0)|0, pup = w0;
                    for(i = 0; i < h0; ++i, p+=w1, pup+=w1) {
                        dst_tilted[p] += dst_tilted[pup];
                    }

                    for(j = w0-1; j > 0; --j) {
                        p = j+h0*w1, pup=p-w1;
                        for(i = h0; i > 0; --i, p-=w1, pup-=w1) {
                            dst_tilted[p] += dst_tilted[pup] + dst_tilted[pup+1];
                        }
                    }
                }
            },
            equalize_histogram: function(src, dst) {
                var w=src.cols,h=src.rows,src_d=src.data;

                dst.resize(w, h, src.channel);

                var dst_d=dst.data,size=w*h;
                var i=0,prev=0,hist0,norm;

                var hist0_node = jsfeat.cache.get_buffer(256<<2);
                hist0 = hist0_node.i32;
                for(; i < 256; ++i) hist0[i] = 0;
                for (i = 0; i < size; ++i) {
                    ++hist0[src_d[i]];
                }

                prev = hist0[0];
                for (i = 1; i < 256; ++i) {
                    prev = hist0[i] += prev;
                }

                norm = 255 / size;
                for (i = 0; i < size; ++i) {
                    dst_d[i] = (hist0[src_d[i]] * norm + 0.5)|0;
                }
                jsfeat.cache.put_buffer(hist0_node);
            },

            canny: function(src, dst, low_thresh, high_thresh) {
                var w=src.cols,h=src.rows,src_d=src.data;

                dst.resize(w, h, src.channel);
                
                var dst_d=dst.data;
                var i=0,j=0,grad=0,w2=w<<1,_grad=0,suppress=0,f=0,x=0,y=0,s=0;
                var tg22x=0,tg67x=0;

                // cache buffers
                var dxdy_node = jsfeat.cache.get_buffer((h * w2)<<2);
                var buf_node = jsfeat.cache.get_buffer((3 * (w + 2))<<2);
                var map_node = jsfeat.cache.get_buffer(((h+2) * (w + 2))<<2);
                var stack_node = jsfeat.cache.get_buffer((h * w)<<2);
                

                var buf = buf_node.i32;
                var map = map_node.i32;
                var stack = stack_node.i32;
                var dxdy = dxdy_node.i32;
                var dxdy_m = new jsfeat.matrix_t(w, h, jsfeat.S32C2_t, dxdy_node.data);
                var row0=1,row1=(w+2+1)|0,row2=(2*(w+2)+1)|0,map_w=(w+2)|0,map_i=(map_w+1)|0,stack_i=0;

                this.sobel_derivatives(src, dxdy_m);

                if(low_thresh > high_thresh) {
                    i = low_thresh;
                    low_thresh = high_thresh;
                    high_thresh = i;
                }

                i = (3 * (w + 2))|0;
                while(--i>=0) {
                    buf[i] = 0;
                }

                i = ((h+2) * (w + 2))|0;
                while(--i>=0) {
                    map[i] = 0;
                }

                for (; j < w; ++j, grad+=2) {
                    //buf[row1+j] = Math.abs(dxdy[grad]) + Math.abs(dxdy[grad+1]);
                    x = dxdy[grad], y = dxdy[grad+1];
                    //buf[row1+j] = x*x + y*y;
                    buf[row1+j] = ((x ^ (x >> 31)) - (x >> 31)) + ((y ^ (y >> 31)) - (y >> 31));
                }

                for(i=1; i <= h; ++i, grad+=w2) {
                    if(i == h) {
                        j = row2+w;
                        while(--j>=row2) {
                            buf[j] = 0;
                        }
                    } else {
                        for (j = 0; j < w; j++) {
                            //buf[row2+j] =  Math.abs(dxdy[grad+(j<<1)]) + Math.abs(dxdy[grad+(j<<1)+1]);
                            x = dxdy[grad+(j<<1)], y = dxdy[grad+(j<<1)+1];
                            //buf[row2+j] = x*x + y*y;
                            buf[row2+j] = ((x ^ (x >> 31)) - (x >> 31)) + ((y ^ (y >> 31)) - (y >> 31));
                        }
                    }
                    _grad = (grad - w2)|0;
                    map[map_i-1] = 0;
                    suppress = 0;
                    for(j = 0; j < w; ++j, _grad+=2) {
                        f = buf[row1+j];
                        if (f > low_thresh) {
                            x = dxdy[_grad];
                            y = dxdy[_grad+1];
                            s = x ^ y;
                            // seems ot be faster than Math.abs
                            x = ((x ^ (x >> 31)) - (x >> 31))|0;
                            y = ((y ^ (y >> 31)) - (y >> 31))|0;
                            //x * tan(22.5) x * tan(67.5) == 2 * x + x * tan(22.5)
                            tg22x = x * 13573;
                            tg67x = tg22x + ((x + x) << 15);
                            y <<= 15;
                            if (y < tg22x) {
                                if (f > buf[row1+j-1] && f >= buf[row1+j+1]) {
                                    if (f > high_thresh && !suppress && map[map_i+j-map_w] != 2) {
                                        map[map_i+j] = 2;
                                        suppress = 1;
                                        stack[stack_i++] = map_i + j;
                                    } else {
                                        map[map_i+j] = 1;
                                    }
                                    continue;
                                }
                            } else if (y > tg67x) {
                                if (f > buf[row0+j] && f >= buf[row2+j]) {
                                    if (f > high_thresh && !suppress && map[map_i+j-map_w] != 2) {
                                        map[map_i+j] = 2;
                                        suppress = 1;
                                        stack[stack_i++] = map_i + j;
                                    } else {
                                        map[map_i+j] = 1;
                                    }
                                    continue;
                                }
                            } else {
                                s = s < 0 ? -1 : 1;
                                if (f > buf[row0+j-s] && f > buf[row2+j+s]) {
                                    if (f > high_thresh && !suppress && map[map_i+j-map_w] != 2) {
                                        map[map_i+j] = 2;
                                        suppress = 1;
                                        stack[stack_i++] = map_i + j;
                                    } else {
                                        map[map_i+j] = 1;
                                    }
                                    continue;
                                }
                            }
                        }
                        map[map_i+j] = 0;
                        suppress = 0;
                    }
                    map[map_i+w] = 0;
                    map_i += map_w;
                    j = row0;
                    row0 = row1;
                    row1 = row2;
                    row2 = j;
                }

                j = map_i - map_w - 1;
                for(i = 0; i < map_w; ++i, ++j) {
                    map[j] = 0;
                }
                // path following
                while(stack_i > 0) {
                    map_i = stack[--stack_i];
                    map_i -= map_w+1;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i += 1;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i += 1;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i += map_w;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i -= 2;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i += map_w;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i += 1;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i += 1;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                }

                map_i = map_w + 1;
                row0 = 0;
                for(i = 0; i < h; ++i, map_i+=map_w) {
                    for(j = 0; j < w; ++j) {
                        dst_d[row0++] = (map[map_i+j] == 2) * 0xff;
                    }
                }

                // free buffers
                jsfeat.cache.put_buffer(dxdy_node);
                jsfeat.cache.put_buffer(buf_node);
                jsfeat.cache.put_buffer(map_node);
                jsfeat.cache.put_buffer(stack_node);
            },
            // transform is 3x3 matrix_t
            warp_perspective: function(src, dst, transform, fill_value) {
                if (typeof fill_value === "undefined") { fill_value = 0; }
                var src_width=src.cols|0, src_height=src.rows|0, dst_width=dst.cols|0, dst_height=dst.rows|0;
                var src_d=src.data, dst_d=dst.data;
                var x=0,y=0,off=0,ixs=0,iys=0,xs=0.0,ys=0.0,xs0=0.0,ys0=0.0,ws=0.0,sc=0.0,a=0.0,b=0.0,p0=0.0,p1=0.0;
                var td=transform.data;
                var m00=td[0],m01=td[1],m02=td[2],
                    m10=td[3],m11=td[4],m12=td[5],
                    m20=td[6],m21=td[7],m22=td[8];

                for(var dptr = 0; y < dst_height; ++y) {
                    xs0 = m01 * y + m02,
                    ys0 = m11 * y + m12,
                    ws  = m21 * y + m22;
                    for(x = 0; x < dst_width; ++x, ++dptr, xs0+=m00, ys0+=m10, ws+=m20) {
                        sc = 1.0 / ws;
                        xs = xs0 * sc, ys = ys0 * sc;
                        ixs = xs | 0, iys = ys | 0;

                        if(xs > 0 && ys > 0 && ixs < (src_width - 1) && iys < (src_height - 1)) {
                            a = Math.max(xs - ixs, 0.0);
                            b = Math.max(ys - iys, 0.0);
                            off = (src_width*iys + ixs)|0;

                            p0 = src_d[off] +  a * (src_d[off+1] - src_d[off]);
                            p1 = src_d[off+src_width] + a * (src_d[off+src_width+1] - src_d[off+src_width]);

                            dst_d[dptr] = p0 + b * (p1 - p0);
                        }
                        else dst_d[dptr] = fill_value;
                    }
                }
            },
            // transform is 3x3 or 2x3 matrix_t only first 6 values referenced
            warp_affine: function(src, dst, transform, fill_value) {
                if (typeof fill_value === "undefined") { fill_value = 0; }
                var src_width=src.cols, src_height=src.rows, dst_width=dst.cols, dst_height=dst.rows;
                var src_d=src.data, dst_d=dst.data;
                var x=0,y=0,off=0,ixs=0,iys=0,xs=0.0,ys=0.0,a=0.0,b=0.0,p0=0.0,p1=0.0;
                var td=transform.data;
                var m00=td[0],m01=td[1],m02=td[2],
                    m10=td[3],m11=td[4],m12=td[5];

                for(var dptr = 0; y < dst_height; ++y) {
                    xs = m01 * y + m02;
                    ys = m11 * y + m12;
                    for(x = 0; x < dst_width; ++x, ++dptr, xs+=m00, ys+=m10) {
                        ixs = xs | 0; iys = ys | 0;

                        if(ixs >= 0 && iys >= 0 && ixs < (src_width - 1) && iys < (src_height - 1)) {
                            a = xs - ixs;
                            b = ys - iys;
                            off = src_width*iys + ixs;

                            p0 = src_d[off] +  a * (src_d[off+1] - src_d[off]);
                            p1 = src_d[off+src_width] + a * (src_d[off+src_width+1] - src_d[off+src_width]);

                            dst_d[dptr] = p0 + b * (p1 - p0);
                        }
                        else dst_d[dptr] = fill_value;
                    }
                }
            },
            
            // Basic RGB Skin detection filter
            // from http://popscan.blogspot.fr/2012/08/skin-detection-in-digital-images.html
            skindetector: function(src,dst) {
                var r,g,b,j;
                var i = src.width*src.height;
                while(i--){
                    j = i*4;
                    r = src.data[j];
                    g = src.data[j+1];
                    b = src.data[j+2];
                    if((r>95)&&(g>40)&&(b>20)
                     &&(r>g)&&(r>b)
                     &&(r-Math.min(g,b)>15)
                     &&(Math.abs(r-g)>15)){
                         dst[i] = 255;
                    } else {
                        dst[i] = 0;
                    }
                }                
            }
        };
    })();

    global.imgproc = imgproc;

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 *
 * This is FAST corner detector, contributed to OpenCV by the author, Edward Rosten.
 */

/*
The references are:
 * Machine learning for high-speed corner detection,
   E. Rosten and T. Drummond, ECCV 2006
 * Faster and better: A machine learning approach to corner detection
   E. Rosten, R. Porter and T. Drummond, PAMI, 2009  
*/

(function(global) {
    "use strict";
    //
    var fast_corners = (function() {

        var offsets16 = new Int32Array([0, 3, 1, 3, 2, 2, 3, 1, 3, 0, 3, -1, 2, -2, 1, -3, 0, -3, -1, -3, -2, -2, -3, -1, -3, 0, -3, 1, -2, 2, -1, 3]);

        var threshold_tab = new Uint8Array(512);
        var pixel_off = new Int32Array(25);
        var score_diff = new Int32Array(25);

        // private functions
        var _cmp_offsets = function(pixel, step, pattern_size) {
            var k = 0;
            var offsets = offsets16;
            for( ; k < pattern_size; ++k ) {
                pixel[k] = offsets[k<<1] + offsets[(k<<1)+1] * step;
            }
            for( ; k < 25; ++k ) {
                pixel[k] = pixel[k - pattern_size];
            }
        },

        _cmp_score_16 = function(src, off, pixel, d, threshold) {
            var N = 25, k = 0, v = src[off];
            var a0 = threshold,a=0,b0=0,b=0;

            for( ; k < N; ++k ) {
                d[k] = v - src[off+pixel[k]];
            }

            for( k = 0; k < 16; k += 2 ) {
                a = Math.min(d[k+1], d[k+2]);
                a = Math.min(a, d[k+3]);

                if( a <= a0 ) continue;

                a = Math.min(a, d[k+4]);
                a = Math.min(a, d[k+5]);
                a = Math.min(a, d[k+6]);
                a = Math.min(a, d[k+7]);
                a = Math.min(a, d[k+8]);
                a0 = Math.max(a0, Math.min(a, d[k]));
                a0 = Math.max(a0, Math.min(a, d[k+9]));
            }

            b0 = -a0;
            for( k = 0; k < 16; k += 2 ) {
                b = Math.max(d[k+1], d[k+2]);
                b = Math.max(b, d[k+3]);
                b = Math.max(b, d[k+4]);
                b = Math.max(b, d[k+5]);

                if( b >= b0 ) continue;
                b = Math.max(b, d[k+6]);
                b = Math.max(b, d[k+7]);
                b = Math.max(b, d[k+8]);
                b0 = Math.min(b0, Math.max(b, d[k]));
                b0 = Math.min(b0, Math.max(b, d[k+9]));
            }

            return -b0-1;
        };

        var _threshold = 20;

        return {
            set_threshold: function(threshold) {
                _threshold = Math.min(Math.max(threshold, 0), 255);
                for (var i = -255; i <= 255; ++i) {
                    threshold_tab[(i + 255)] = (i < -_threshold ? 1 : (i > _threshold ? 2 : 0));
                }
                return _threshold;
            },
            
            detect: function(src, corners, border) {
                if (typeof border === "undefined") { border = 3; }

                var K = 8, N = 25;
                var img = src.data, w = src.cols, h = src.rows;
                var i=0, j=0, k=0, vt=0, x=0, m3=0;
                var buf_node = jsfeat.cache.get_buffer(3 * w);
                var cpbuf_node = jsfeat.cache.get_buffer(((w+1)*3)<<2);
                var buf = buf_node.u8;
                var cpbuf = cpbuf_node.i32;
                var pixel = pixel_off;
                var sd = score_diff;
                var sy = Math.max(3, border);
                var ey = Math.min((h-2), (h-border));
                var sx = Math.max(3, border);
                var ex = Math.min((w - 3), (w - border));
                var _count = 0, corners_cnt = 0, pt;
                var score_func = _cmp_score_16;
                var thresh_tab = threshold_tab;
                var threshold = _threshold;

                var v=0,tab=0,d=0,ncorners=0,cornerpos=0,curr=0,ptr=0,prev=0,pprev=0;
                var jp1=0,jm1=0,score=0;

                _cmp_offsets(pixel, w, 16);

                // local vars are faster?
                var pixel0 = pixel[0];
                var pixel1 = pixel[1];
                var pixel2 = pixel[2];
                var pixel3 = pixel[3];
                var pixel4 = pixel[4];
                var pixel5 = pixel[5];
                var pixel6 = pixel[6];
                var pixel7 = pixel[7];
                var pixel8 = pixel[8];
                var pixel9 = pixel[9];
                var pixel10 = pixel[10];
                var pixel11 = pixel[11];
                var pixel12 = pixel[12];
                var pixel13 = pixel[13];
                var pixel14 = pixel[14];
                var pixel15 = pixel[15];

                for(i = 0; i < w*3; ++i) {
                    buf[i] = 0;
                }

                for(i = sy; i < ey; ++i) {
                    ptr = ((i * w) + sx)|0;
                    m3 = (i - 3)%3;
                    curr = (m3*w)|0;
                    cornerpos = (m3*(w+1))|0;
                    for (j = 0; j < w; ++j) buf[curr+j] = 0;
                    ncorners = 0;
                    
                    if( i < (ey - 1) ) {
                        j = sx;
                        
                        for( ; j < ex; ++j, ++ptr ) {
                            v = img[ptr];
                            tab = ( - v + 255 );
                            d = ( thresh_tab[tab+img[ptr+pixel0]] | thresh_tab[tab+img[ptr+pixel8]] );
                            
                            if( d == 0 ) {
                                continue;
                            }
                            
                            d &= ( thresh_tab[tab+img[ptr+pixel2]] | thresh_tab[tab+img[ptr+pixel10]] );
                            d &= ( thresh_tab[tab+img[ptr+pixel4]] | thresh_tab[tab+img[ptr+pixel12]] );
                            d &= ( thresh_tab[tab+img[ptr+pixel6]] | thresh_tab[tab+img[ptr+pixel14]] );
                            
                            if( d == 0 ) {
                                continue;
                            }
                            
                            d &= ( thresh_tab[tab+img[ptr+pixel1]] | thresh_tab[tab+img[ptr+pixel9]] );
                            d &= ( thresh_tab[tab+img[ptr+pixel3]] | thresh_tab[tab+img[ptr+pixel11]] );
                            d &= ( thresh_tab[tab+img[ptr+pixel5]] | thresh_tab[tab+img[ptr+pixel13]] );
                            d &= ( thresh_tab[tab+img[ptr+pixel7]] | thresh_tab[tab+img[ptr+pixel15]] );
                            
                            if( d & 1 ) {
                                vt = (v - threshold);
                                _count = 0;
                                
                                for( k = 0; k < N; ++k ) {
                                    x = img[(ptr+pixel[k])];
                                    if(x < vt) {
                                        ++_count;
                                        if( _count > K ) {
                                            ++ncorners;
                                            cpbuf[cornerpos+ncorners] = j;
                                            buf[curr+j] = score_func(img, ptr, pixel, sd, threshold);
                                            break;
                                        }
                                    }
                                    else {
                                        _count = 0;
                                    }
                                }
                            }
                            
                            if( d & 2 ) {
                                vt = (v + threshold);
                                _count = 0;
                                
                                for( k = 0; k < N; ++k ) {
                                    x = img[(ptr+pixel[k])];
                                    if(x > vt) {
                                        ++_count;
                                        if( _count > K ) {
                                            ++ncorners;
                                            cpbuf[cornerpos+ncorners] = j;
                                            buf[curr+j] = score_func(img, ptr, pixel, sd, threshold);
                                            break;
                                        }
                                    }
                                    else {
                                        _count = 0;
                                    }
                                }
                            }
                        }
                    }
                    
                    cpbuf[cornerpos+w] = ncorners;
            
                    if ( i == sy ) {
                        continue;
                    }
                    
                    m3 = (i - 4 + 3)%3;
                    prev = (m3*w)|0;
                    cornerpos = (m3*(w+1))|0;
                    m3 = (i - 5 + 3)%3;
                    pprev = (m3*w)|0;

                    ncorners = cpbuf[cornerpos+w];
                    
                    for( k = 0; k < ncorners; ++k ) {
                        j = cpbuf[cornerpos+k];
                        jp1 = (j+1)|0;
                        jm1 = (j-1)|0;
                        score = buf[prev+j];
                        if( (score > buf[prev+jp1] && score > buf[prev+jm1] &&
                            score > buf[pprev+jm1] && score > buf[pprev+j] && score > buf[pprev+jp1] &&
                            score > buf[curr+jm1] && score > buf[curr+j] && score > buf[curr+jp1]) ) {
                            // save corner
                            pt = corners[corners_cnt];
                            pt.x = j, pt.y = (i-1), pt.score = score;
                            corners_cnt++;
                        }
                    }
                } // y loop
                jsfeat.cache.put_buffer(buf_node);
                jsfeat.cache.put_buffer(cpbuf_node);
                return corners_cnt;
            }
        };
    })();

    global.fast_corners = fast_corners;
    fast_corners.set_threshold(20); // set default

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 *
 * Copyright 2007 Computer Vision Lab,
 * Ecole Polytechnique Federale de Lausanne (EPFL), Switzerland.
 * @author Vincent Lepetit (http://cvlab.epfl.ch/~lepetit)
 */

(function(global) {
    "use strict";
    //

    var yape06 = (function() {
        
        var compute_laplacian = function(src, dst, w, h, Dxx, Dyy, sx,sy, ex,ey) {
            var y=0,x=0,yrow=(sy*w+sx)|0,row=yrow;

            for(y = sy; y < ey; ++y, yrow+=w, row = yrow) {
                for(x = sx; x < ex; ++x, ++row) {
                    dst[row] = -4 * src[row] + src[row+Dxx] + src[row-Dxx] + src[row+Dyy] + src[row-Dyy];
                }
            }
        }

        var hessian_min_eigen_value = function(src, off, tr, Dxx, Dyy, Dxy, Dyx) {
            var Ixx = -2 * src[off] + src[off + Dxx] + src[off - Dxx];
            var Iyy = -2 * src[off] + src[off + Dyy] + src[off - Dyy];
            var Ixy = src[off + Dxy] + src[off - Dxy] - src[off + Dyx] - src[off - Dyx];
            var sqrt_delta = ( Math.sqrt(((Ixx - Iyy) * (Ixx - Iyy) + 4 * Ixy * Ixy) ) )|0;

            return Math.min(Math.abs(tr - sqrt_delta), Math.abs(-(tr + sqrt_delta)));
        }

        return {

            laplacian_threshold: 30,
            min_eigen_value_threshold: 25,

            detect: function(src, points, border) {
                if (typeof border === "undefined") { border = 5; }
                var x=0,y=0;
                var w=src.cols, h=src.rows, srd_d=src.data;
                var Dxx = 5, Dyy = (5 * w)|0;
                var Dxy = (3 + 3 * w)|0, Dyx = (3 - 3 * w)|0;
                var lap_buf = jsfeat.cache.get_buffer((w*h)<<2);
                var laplacian = lap_buf.i32;
                var lv=0, row=0,rowx=0,min_eigen_value=0,pt;
                var number_of_points = 0;
                var lap_thresh = this.laplacian_threshold;
                var eigen_thresh = this.min_eigen_value_threshold;

                var sx = Math.max(5, border)|0;
                var sy = Math.max(3, border)|0;
                var ex = Math.min(w-5, w-border)|0;
                var ey = Math.min(h-3, h-border)|0;

                x = w*h;
                while(--x>=0) {laplacian[x]=0;}
                compute_laplacian(srd_d, laplacian, w, h, Dxx, Dyy, sx,sy, ex,ey);

                row = (sy*w+sx)|0;
                for(y = sy; y < ey; ++y, row += w) {
                    for(x = sx, rowx=row; x < ex; ++x, ++rowx) {

                        lv = laplacian[rowx];
                        if ((lv < -lap_thresh &&
                            lv < laplacian[rowx - 1]      && lv < laplacian[rowx + 1] &&
                            lv < laplacian[rowx - w]     && lv < laplacian[rowx + w] &&
                            lv < laplacian[rowx - w - 1] && lv < laplacian[rowx + w - 1] &&
                            lv < laplacian[rowx - w + 1] && lv < laplacian[rowx + w + 1])
                            ||
                            (lv > lap_thresh &&
                            lv > laplacian[rowx - 1]      && lv > laplacian[rowx + 1] &&
                            lv > laplacian[rowx - w]     && lv > laplacian[rowx + w] &&
                            lv > laplacian[rowx - w - 1] && lv > laplacian[rowx + w - 1] &&
                            lv > laplacian[rowx - w + 1] && lv > laplacian[rowx + w + 1])
                            ) {

                            min_eigen_value = hessian_min_eigen_value(srd_d, rowx, lv, Dxx, Dyy, Dxy, Dyx);
                            if (min_eigen_value > eigen_thresh) {
                                pt = points[number_of_points];
                                pt.x = x, pt.y = y, pt.score = min_eigen_value;
                                ++number_of_points;
                                ++x, ++rowx; // skip next pixel since this is maxima in 3x3
                            }
                        }
                    }
                }

                jsfeat.cache.put_buffer(lap_buf);

                return number_of_points;
            }

        };
    })();

    global.yape06 = yape06;

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 *
 * Copyright 2007 Computer Vision Lab,
 * Ecole Polytechnique Federale de Lausanne (EPFL), Switzerland.
 */

(function(global) {
    "use strict";
    //

    var yape = (function() {

        var precompute_directions = function(step, dirs, R) {
            var i = 0;
            var x, y;

            x = R;
            for(y = 0; y < x; y++, i++)
            {
                x = (Math.sqrt((R * R - y * y)) + 0.5)|0;
                dirs[i] = (x + step * y);
            }
            for(x-- ; x < y && x >= 0; x--, i++)
            {
                y = (Math.sqrt((R * R - x * x)) + 0.5)|0;
                dirs[i] = (x + step * y);
            }
            for( ; -x < y; x--, i++)
            {
                y = (Math.sqrt((R * R - x * x)) + 0.5)|0;
                dirs[i] = (x + step * y);
            }
            for(y-- ; y >= 0; y--, i++)
            {
                x = (-Math.sqrt((R * R - y * y)) - 0.5)|0;
                dirs[i] = (x + step * y);
            }
            for(; y > x; y--, i++)
            {
                x = (-Math.sqrt((R * R - y * y)) - 0.5)|0;
                dirs[i] = (x + step * y);
            }
            for(x++ ; x <= 0; x++, i++)
            {
                y = (-Math.sqrt((R * R - x * x)) - 0.5)|0;
                dirs[i] = (x + step * y);
            }
            for( ; x < -y; x++, i++)
            {
                y = (-Math.sqrt((R * R - x * x)) - 0.5)|0;
                dirs[i] = (x + step * y);
            }
            for(y++ ; y < 0; y++, i++)
            {
                x = (Math.sqrt((R * R - y * y)) + 0.5)|0;
                dirs[i] = (x + step * y);
            }

            dirs[i] = dirs[0];
            dirs[i + 1] = dirs[1];
            return i;
        }

        var third_check = function (Sb, off, step) {
            var n = 0;
            if(Sb[off+1]   != 0) n++;
            if(Sb[off-1]   != 0) n++;
            if(Sb[off+step]   != 0) n++;
            if(Sb[off+step+1] != 0) n++;
            if(Sb[off+step-1] != 0) n++;
            if(Sb[off-step]   != 0) n++;
            if(Sb[off-step+1] != 0) n++;
            if(Sb[off-step-1] != 0) n++;

            return n;
        }

        var is_local_maxima = function(p, off, v, step, neighborhood) {
            var x, y;

            if (v > 0) {
                off -= step*neighborhood;
                for (y= -neighborhood; y<=neighborhood; ++y) {
                    for (x= -neighborhood; x<=neighborhood; ++x) {
                        if (p[off+x] > v) return false;
                    }
                    off += step;
                }
            } else {
                off -= step*neighborhood;
                for (y= -neighborhood; y<=neighborhood; ++y) {
                    for (x= -neighborhood; x<=neighborhood; ++x) {
                        if (p[off+x] < v) return false;
                    }
                    off += step;
                }
            }
            return true;
        }

        var perform_one_point = function(I, x, Scores, Im, Ip, dirs, opposite, dirs_nb) {
          var score = 0;
          var a = 0, b = (opposite - 1)|0;
          var A=0, B0=0, B1=0, B2=0;
          var state=0;

          // WE KNOW THAT NOT(A ~ I0 & B1 ~ I0):
          A = I[x+dirs[a]];
          if ((A <= Ip)) {
            if ((A >= Im)) { // A ~ I0
              B0 = I[x+dirs[b]];
              if ((B0 <= Ip)) {
                if ((B0 >= Im)) { Scores[x] = 0; return; }
                else {
                  b++; B1 = I[x+dirs[b]];
                  if ((B1 > Ip)) {
                    b++; B2 = I[x+dirs[b]];
                    if ((B2 > Ip)) state = 3;
                    else if ((B2 < Im)) state = 6;
                    else { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0
                  }
                  else/* if ((B1 < Im))*/ {
                    b++; B2 = I[x+dirs[b]];
                    if ((B2 > Ip)) state = 7;
                    else if ((B2 < Im)) state = 2;
                    else { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0
                  }
                  //else { Scores[x] = 0; return; } // A ~ I0, B1 ~ I0
                }
              }
              else { // B0 < I0
                b++; B1 = I[x+dirs[b]];
                if ((B1 > Ip)) {
                  b++; B2 = I[x+dirs[b]];
                  if ((B2 > Ip)) state = 3;
                  else if ((B2 < Im)) state = 6;
                  else { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0
                }
                else if ((B1 < Im)) {
                  b++; B2 = I[x+dirs[b]];
                  if ((B2 > Ip)) state = 7;
                  else if ((B2 < Im)) state = 2;
                  else { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0
                }
                else { Scores[x] = 0; return; } // A ~ I0, B1 ~ I0
              }
            }
            else { // A > I0
              B0 = I[x+dirs[b]];
              if ((B0 > Ip)) { Scores[x] = 0; return; }
                b++; B1 = I[x+dirs[b]];
              if ((B1 > Ip)) { Scores[x] = 0; return; }
                b++; B2 = I[x+dirs[b]];
              if ((B2 > Ip)) { Scores[x] = 0; return; }
                state = 1;
            }
          }
          else // A < I0
          {
            B0 = I[x+dirs[b]];
            if ((B0 < Im)) { Scores[x] = 0; return; }
              b++; B1 = I[x+dirs[b]];
            if ((B1 < Im)) { Scores[x] = 0; return; }
              b++; B2 = I[x+dirs[b]];
            if ((B2 < Im)) { Scores[x] = 0; return; }
              state = 0;
          }

          for(a = 1; a <= opposite; a++)
          {
            A = I[x+dirs[a]];

            switch(state)
            {
            case 0:
              if ((A > Ip)) {
                B1 = B2; b++; B2 = I[x+dirs[b]];
                if ((B2 < Im)) { Scores[x] = 0; return; }
                  { score -= A + B1; state = 0; break; };
              }
              if ((A < Im)) {
                if ((B1 > Ip)) { Scores[x] = 0; return; }
                  if ((B2 > Ip)) { Scores[x] = 0; return; }
                    B1 = B2; b++; B2 = I[x+dirs[b]];
                if ((B2 > Ip)) { Scores[x] = 0; return; }
                  { score -= A + B1; state = 8; break; };
              } 
              // A ~ I0
              if ((B1 <= Ip)) { Scores[x] = 0; return; }
                if ((B2 <= Ip)) { Scores[x] = 0; return; }
                  B1 = B2; b++; B2 = I[x+dirs[b]];
              if ((B2 > Ip)) { score -= A + B1; state = 3; break; };
              if ((B2 < Im)) { score -= A + B1; state = 6; break; };
              { Scores[x] = 0; return; }

            case 1:
              if ((A < Im)) {
                B1 = B2; b++; B2 = I[x+dirs[b]];
                if ((B2 > Ip)) { Scores[x] = 0; return; }
                  { score -= A + B1; state = 1; break; };
              }
              if ((A > Ip)) {
                if ((B1 < Im)) { Scores[x] = 0; return; }
                  if ((B2 < Im)) { Scores[x] = 0; return; }
                    B1 = B2; b++; B2 = I[x+dirs[b]];
                if ((B2 < Im)) { Scores[x] = 0; return; }
                  { score -= A + B1; state = 9; break; };
              }
              // A ~ I0
              if ((B1 >= Im)) { Scores[x] = 0; return; }
                if ((B2 >= Im)) { Scores[x] = 0; return; }
                  B1 = B2; b++; B2 = I[x+dirs[b]];
              if ((B2 < Im)) { score -= A + B1; state = 2; break; };
              if ((B2 > Ip)) { score -= A + B1; state = 7; break; };
              { Scores[x] = 0; return; }

            case 2:
              if ((A > Ip)) { Scores[x] = 0; return; }
                B1 = B2; b++; B2 = I[x+dirs[b]];
              if ((A < Im))
              {
                if ((B2 > Ip)) { Scores[x] = 0; return; }
                  { score -= A + B1; state = 4; break; };
              } 
              // A ~ I0
              if ((B2 > Ip)) { score -= A + B1; state = 7; break; };
              if ((B2 < Im)) { score -= A + B1; state = 2; break; };
              { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0

            case 3:
              if ((A < Im)) { Scores[x] = 0; return; }
                B1 = B2; b++; B2 = I[x+dirs[b]];
              if ((A > Ip)) {
                if ((B2 < Im)) { Scores[x] = 0; return; }
                  { score -= A + B1; state = 5; break; };
              }
              // A ~ I0
              if ((B2 > Ip)) { score -= A + B1; state = 3; break; };
              if ((B2 < Im)) { score -= A + B1; state = 6; break; };
              { Scores[x] = 0; return; }

            case 4:
              if ((A > Ip)) { Scores[x] = 0; return; }
                if ((A < Im)) {
                  B1 = B2; b++; B2 = I[x+dirs[b]];
                  if ((B2 > Ip)) { Scores[x] = 0; return; }
                    { score -= A + B1; state = 1; break; };
                }
                if ((B2 >= Im)) { Scores[x] = 0; return; }
                  B1 = B2; b++; B2 = I[x+dirs[b]];
                if ((B2 < Im)) { score -= A + B1; state = 2; break; };
                if ((B2 > Ip)) { score -= A + B1; state = 7; break; };
                { Scores[x] = 0; return; }

            case 5:
              if ((A < Im)) { Scores[x] = 0; return; }
                if ((A > Ip)) {
                  B1 = B2; b++; B2 = I[x+dirs[b]];
                  if ((B2 < Im)) { Scores[x] = 0; return; }
                    { score -= A + B1; state = 0; break; };
                }
                // A ~ I0
                if ((B2 <= Ip)) { Scores[x] = 0; return; }
                  B1 = B2; b++; B2 = I[x+dirs[b]];
                if ((B2 > Ip)) { score -= A + B1; state = 3; break; };
                if ((B2 < Im)) { score -= A + B1; state = 6; break; };
                { Scores[x] = 0; return; }

            case 7:
              if ((A > Ip)) { Scores[x] = 0; return; }
                if ((A < Im)) { Scores[x] = 0; return; }
                  B1 = B2; b++; B2 = I[x+dirs[b]];
              // A ~ I0
              if ((B2 > Ip)) { score -= A + B1; state = 3; break; };
              if ((B2 < Im)) { score -= A + B1; state = 6; break; };
              { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0

            case 6:
              if ((A > Ip)) { Scores[x] = 0; return; }
                if ((A < Im)) { Scores[x] = 0; return; }
                  B1 = B2; b++; B2 = I[x+dirs[b]];
              // A ~ I0
              if ((B2 < Im)) { score -= A + B1; state = 2; break; };
              if ((B2 > Ip)) { score -= A + B1; state = 7; break; };
              { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0

            case 8:
              if ((A > Ip)) {
                if ((B2 < Im)) { Scores[x] = 0; return; }
                  B1 = B2; b++; B2 = I[x+dirs[b]];
                if ((B2 < Im)) { Scores[x] = 0; return; }
                  { score -= A + B1; state = 9; break; };
              }
              if ((A < Im)) {
                B1 = B2; b++; B2 = I[x+dirs[b]];
                if ((B2 > Ip)) { Scores[x] = 0; return; }
                  { score -= A + B1; state = 1; break; };
              }
              { Scores[x] = 0; return; }

            case 9:
              if ((A < Im)) {
                if ((B2 > Ip)) { Scores[x] = 0; return; }
                  B1 = B2; b++; B2 = I[x+dirs[b]];
                if ((B2 > Ip)) { Scores[x] = 0; return; }
                  { score -= A + B1; state = 8; break; };
              }
              if ((A > Ip)) {
                B1 = B2; b++; B2 = I[x+dirs[b]];
                if ((B2 < Im)) { Scores[x] = 0; return; }
                  { score -= A + B1; state = 0; break; };
              }
              { Scores[x] = 0; return; }

            default:
              //"PB default";
              break;
            } // switch(state)
          } // for(a...)

          Scores[x] = (score + dirs_nb * I[x]);
        }

        var lev_table_t = (function () {
            function lev_table_t(w, h, r) {
                this.dirs = new Int32Array(1024);
                this.dirs_count = precompute_directions(w, this.dirs, r)|0;
                this.scores = new Int32Array(w*h);
                this.radius = r|0;
            }
            return lev_table_t;
        })();
        
        return {

            level_tables: [],
            tau: 7,

            init: function(width, height, radius, pyramid_levels) {
                if (typeof pyramid_levels === "undefined") { pyramid_levels = 1; }
                var i;
                radius = Math.min(radius, 7);
                radius = Math.max(radius, 3);
                for(i = 0; i < pyramid_levels; ++i) {
                    this.level_tables[i] = new lev_table_t(width>>i, height>>i, radius);
                }
            },

            detect: function(src, points, border) {
                if (typeof border === "undefined") { border = 4; }
                var t = this.level_tables[0];
                var R = t.radius|0, Rm1 = (R-1)|0;
                var dirs = t.dirs;
                var dirs_count = t.dirs_count|0;
                var opposite = dirs_count >> 1;
                var img = src.data, w=src.cols|0, h=src.rows|0,hw=w>>1;
                var scores = t.scores;
                var x=0,y=0,row=0,rowx=0,ip=0,im=0,abs_score=0, score=0;
                var tau = this.tau|0;
                var number_of_points = 0, pt;

                var sx = Math.max(R+1, border)|0;
                var sy = Math.max(R+1, border)|0;
                var ex = Math.min(w-R-2, w-border)|0;
                var ey = Math.min(h-R-2, h-border)|0;

                row = (sy*w+sx)|0;
                for(y = sy; y < ey; ++y, row+=w) {
                    for(x = sx, rowx = row; x < ex; ++x, ++rowx) {
                        ip = img[rowx] + tau, im = img[rowx] - tau;

                        if (im<img[rowx+R] && img[rowx+R]<ip && im<img[rowx-R] && img[rowx-R]<ip) {
                            scores[rowx] = 0;
                        } else {
                            perform_one_point(img, rowx, scores, im, ip, dirs, opposite, dirs_count);
                        }
                    }
                }

                // local maxima
                row = (sy*w+sx)|0;
                for(y = sy; y < ey; ++y, row+=w) {
                    for(x = sx, rowx = row; x < ex; ++x, ++rowx) {
                        score = scores[rowx];
                        abs_score = Math.abs(score);
                        if(abs_score < 5) {
                            // if this pixel is 0, the next one will not be good enough. Skip it.
                            ++x, ++rowx;
                        } else {
                            if(third_check(scores, rowx, w) >= 3 && is_local_maxima(scores, rowx, score, hw, R)) {
                                pt = points[number_of_points];
                                pt.x = x, pt.y = y, pt.score = abs_score;
                                ++number_of_points;

                                x += Rm1, rowx += Rm1;
                            }
                        }
                    }
                }

                return number_of_points;
            }
        };

    })();

    global.yape = yape;

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 *
 * Original implementation derived from OpenCV,
 * @authors Ethan Rublee, Vincent Rabaud, Gary Bradski
 */

(function(global) {
    "use strict";
    //

    var orb = (function() {

    	var bit_pattern_31_ = new Int32Array([
		    8,-3, 9,5/*mean (0), correlation (0)*/,
		    4,2, 7,-12/*mean (1.12461e-05), correlation (0.0437584)*/,
		    -11,9, -8,2/*mean (3.37382e-05), correlation (0.0617409)*/,
		    7,-12, 12,-13/*mean (5.62303e-05), correlation (0.0636977)*/,
		    2,-13, 2,12/*mean (0.000134953), correlation (0.085099)*/,
		    1,-7, 1,6/*mean (0.000528565), correlation (0.0857175)*/,
		    -2,-10, -2,-4/*mean (0.0188821), correlation (0.0985774)*/,
		    -13,-13, -11,-8/*mean (0.0363135), correlation (0.0899616)*/,
		    -13,-3, -12,-9/*mean (0.121806), correlation (0.099849)*/,
		    10,4, 11,9/*mean (0.122065), correlation (0.093285)*/,
		    -13,-8, -8,-9/*mean (0.162787), correlation (0.0942748)*/,
		    -11,7, -9,12/*mean (0.21561), correlation (0.0974438)*/,
		    7,7, 12,6/*mean (0.160583), correlation (0.130064)*/,
		    -4,-5, -3,0/*mean (0.228171), correlation (0.132998)*/,
		    -13,2, -12,-3/*mean (0.00997526), correlation (0.145926)*/,
		    -9,0, -7,5/*mean (0.198234), correlation (0.143636)*/,
		    12,-6, 12,-1/*mean (0.0676226), correlation (0.16689)*/,
		    -3,6, -2,12/*mean (0.166847), correlation (0.171682)*/,
		    -6,-13, -4,-8/*mean (0.101215), correlation (0.179716)*/,
		    11,-13, 12,-8/*mean (0.200641), correlation (0.192279)*/,
		    4,7, 5,1/*mean (0.205106), correlation (0.186848)*/,
		    5,-3, 10,-3/*mean (0.234908), correlation (0.192319)*/,
		    3,-7, 6,12/*mean (0.0709964), correlation (0.210872)*/,
		    -8,-7, -6,-2/*mean (0.0939834), correlation (0.212589)*/,
		    -2,11, -1,-10/*mean (0.127778), correlation (0.20866)*/,
		    -13,12, -8,10/*mean (0.14783), correlation (0.206356)*/,
		    -7,3, -5,-3/*mean (0.182141), correlation (0.198942)*/,
		    -4,2, -3,7/*mean (0.188237), correlation (0.21384)*/,
		    -10,-12, -6,11/*mean (0.14865), correlation (0.23571)*/,
		    5,-12, 6,-7/*mean (0.222312), correlation (0.23324)*/,
		    5,-6, 7,-1/*mean (0.229082), correlation (0.23389)*/,
		    1,0, 4,-5/*mean (0.241577), correlation (0.215286)*/,
		    9,11, 11,-13/*mean (0.00338507), correlation (0.251373)*/,
		    4,7, 4,12/*mean (0.131005), correlation (0.257622)*/,
		    2,-1, 4,4/*mean (0.152755), correlation (0.255205)*/,
		    -4,-12, -2,7/*mean (0.182771), correlation (0.244867)*/,
		    -8,-5, -7,-10/*mean (0.186898), correlation (0.23901)*/,
		    4,11, 9,12/*mean (0.226226), correlation (0.258255)*/,
		    0,-8, 1,-13/*mean (0.0897886), correlation (0.274827)*/,
		    -13,-2, -8,2/*mean (0.148774), correlation (0.28065)*/,
		    -3,-2, -2,3/*mean (0.153048), correlation (0.283063)*/,
		    -6,9, -4,-9/*mean (0.169523), correlation (0.278248)*/,
		    8,12, 10,7/*mean (0.225337), correlation (0.282851)*/,
		    0,9, 1,3/*mean (0.226687), correlation (0.278734)*/,
		    7,-5, 11,-10/*mean (0.00693882), correlation (0.305161)*/,
		    -13,-6, -11,0/*mean (0.0227283), correlation (0.300181)*/,
		    10,7, 12,1/*mean (0.125517), correlation (0.31089)*/,
		    -6,-3, -6,12/*mean (0.131748), correlation (0.312779)*/,
		    10,-9, 12,-4/*mean (0.144827), correlation (0.292797)*/,
		    -13,8, -8,-12/*mean (0.149202), correlation (0.308918)*/,
		    -13,0, -8,-4/*mean (0.160909), correlation (0.310013)*/,
		    3,3, 7,8/*mean (0.177755), correlation (0.309394)*/,
		    5,7, 10,-7/*mean (0.212337), correlation (0.310315)*/,
		    -1,7, 1,-12/*mean (0.214429), correlation (0.311933)*/,
		    3,-10, 5,6/*mean (0.235807), correlation (0.313104)*/,
		    2,-4, 3,-10/*mean (0.00494827), correlation (0.344948)*/,
		    -13,0, -13,5/*mean (0.0549145), correlation (0.344675)*/,
		    -13,-7, -12,12/*mean (0.103385), correlation (0.342715)*/,
		    -13,3, -11,8/*mean (0.134222), correlation (0.322922)*/,
		    -7,12, -4,7/*mean (0.153284), correlation (0.337061)*/,
		    6,-10, 12,8/*mean (0.154881), correlation (0.329257)*/,
		    -9,-1, -7,-6/*mean (0.200967), correlation (0.33312)*/,
		    -2,-5, 0,12/*mean (0.201518), correlation (0.340635)*/,
		    -12,5, -7,5/*mean (0.207805), correlation (0.335631)*/,
		    3,-10, 8,-13/*mean (0.224438), correlation (0.34504)*/,
		    -7,-7, -4,5/*mean (0.239361), correlation (0.338053)*/,
		    -3,-2, -1,-7/*mean (0.240744), correlation (0.344322)*/,
		    2,9, 5,-11/*mean (0.242949), correlation (0.34145)*/,
		    -11,-13, -5,-13/*mean (0.244028), correlation (0.336861)*/,
		    -1,6, 0,-1/*mean (0.247571), correlation (0.343684)*/,
		    5,-3, 5,2/*mean (0.000697256), correlation (0.357265)*/,
		    -4,-13, -4,12/*mean (0.00213675), correlation (0.373827)*/,
		    -9,-6, -9,6/*mean (0.0126856), correlation (0.373938)*/,
		    -12,-10, -8,-4/*mean (0.0152497), correlation (0.364237)*/,
		    10,2, 12,-3/*mean (0.0299933), correlation (0.345292)*/,
		    7,12, 12,12/*mean (0.0307242), correlation (0.366299)*/,
		    -7,-13, -6,5/*mean (0.0534975), correlation (0.368357)*/,
		    -4,9, -3,4/*mean (0.099865), correlation (0.372276)*/,
		    7,-1, 12,2/*mean (0.117083), correlation (0.364529)*/,
		    -7,6, -5,1/*mean (0.126125), correlation (0.369606)*/,
		    -13,11, -12,5/*mean (0.130364), correlation (0.358502)*/,
		    -3,7, -2,-6/*mean (0.131691), correlation (0.375531)*/,
		    7,-8, 12,-7/*mean (0.160166), correlation (0.379508)*/,
		    -13,-7, -11,-12/*mean (0.167848), correlation (0.353343)*/,
		    1,-3, 12,12/*mean (0.183378), correlation (0.371916)*/,
		    2,-6, 3,0/*mean (0.228711), correlation (0.371761)*/,
		    -4,3, -2,-13/*mean (0.247211), correlation (0.364063)*/,
		    -1,-13, 1,9/*mean (0.249325), correlation (0.378139)*/,
		    7,1, 8,-6/*mean (0.000652272), correlation (0.411682)*/,
		    1,-1, 3,12/*mean (0.00248538), correlation (0.392988)*/,
		    9,1, 12,6/*mean (0.0206815), correlation (0.386106)*/,
		    -1,-9, -1,3/*mean (0.0364485), correlation (0.410752)*/,
		    -13,-13, -10,5/*mean (0.0376068), correlation (0.398374)*/,
		    7,7, 10,12/*mean (0.0424202), correlation (0.405663)*/,
		    12,-5, 12,9/*mean (0.0942645), correlation (0.410422)*/,
		    6,3, 7,11/*mean (0.1074), correlation (0.413224)*/,
		    5,-13, 6,10/*mean (0.109256), correlation (0.408646)*/,
		    2,-12, 2,3/*mean (0.131691), correlation (0.416076)*/,
		    3,8, 4,-6/*mean (0.165081), correlation (0.417569)*/,
		    2,6, 12,-13/*mean (0.171874), correlation (0.408471)*/,
		    9,-12, 10,3/*mean (0.175146), correlation (0.41296)*/,
		    -8,4, -7,9/*mean (0.183682), correlation (0.402956)*/,
		    -11,12, -4,-6/*mean (0.184672), correlation (0.416125)*/,
		    1,12, 2,-8/*mean (0.191487), correlation (0.386696)*/,
		    6,-9, 7,-4/*mean (0.192668), correlation (0.394771)*/,
		    2,3, 3,-2/*mean (0.200157), correlation (0.408303)*/,
		    6,3, 11,0/*mean (0.204588), correlation (0.411762)*/,
		    3,-3, 8,-8/*mean (0.205904), correlation (0.416294)*/,
		    7,8, 9,3/*mean (0.213237), correlation (0.409306)*/,
		    -11,-5, -6,-4/*mean (0.243444), correlation (0.395069)*/,
		    -10,11, -5,10/*mean (0.247672), correlation (0.413392)*/,
		    -5,-8, -3,12/*mean (0.24774), correlation (0.411416)*/,
		    -10,5, -9,0/*mean (0.00213675), correlation (0.454003)*/,
		    8,-1, 12,-6/*mean (0.0293635), correlation (0.455368)*/,
		    4,-6, 6,-11/*mean (0.0404971), correlation (0.457393)*/,
		    -10,12, -8,7/*mean (0.0481107), correlation (0.448364)*/,
		    4,-2, 6,7/*mean (0.050641), correlation (0.455019)*/,
		    -2,0, -2,12/*mean (0.0525978), correlation (0.44338)*/,
		    -5,-8, -5,2/*mean (0.0629667), correlation (0.457096)*/,
		    7,-6, 10,12/*mean (0.0653846), correlation (0.445623)*/,
		    -9,-13, -8,-8/*mean (0.0858749), correlation (0.449789)*/,
		    -5,-13, -5,-2/*mean (0.122402), correlation (0.450201)*/,
		    8,-8, 9,-13/*mean (0.125416), correlation (0.453224)*/,
		    -9,-11, -9,0/*mean (0.130128), correlation (0.458724)*/,
		    1,-8, 1,-2/*mean (0.132467), correlation (0.440133)*/,
		    7,-4, 9,1/*mean (0.132692), correlation (0.454)*/,
		    -2,1, -1,-4/*mean (0.135695), correlation (0.455739)*/,
		    11,-6, 12,-11/*mean (0.142904), correlation (0.446114)*/,
		    -12,-9, -6,4/*mean (0.146165), correlation (0.451473)*/,
		    3,7, 7,12/*mean (0.147627), correlation (0.456643)*/,
		    5,5, 10,8/*mean (0.152901), correlation (0.455036)*/,
		    0,-4, 2,8/*mean (0.167083), correlation (0.459315)*/,
		    -9,12, -5,-13/*mean (0.173234), correlation (0.454706)*/,
		    0,7, 2,12/*mean (0.18312), correlation (0.433855)*/,
		    -1,2, 1,7/*mean (0.185504), correlation (0.443838)*/,
		    5,11, 7,-9/*mean (0.185706), correlation (0.451123)*/,
		    3,5, 6,-8/*mean (0.188968), correlation (0.455808)*/,
		    -13,-4, -8,9/*mean (0.191667), correlation (0.459128)*/,
		    -5,9, -3,-3/*mean (0.193196), correlation (0.458364)*/,
		    -4,-7, -3,-12/*mean (0.196536), correlation (0.455782)*/,
		    6,5, 8,0/*mean (0.1972), correlation (0.450481)*/,
		    -7,6, -6,12/*mean (0.199438), correlation (0.458156)*/,
		    -13,6, -5,-2/*mean (0.211224), correlation (0.449548)*/,
		    1,-10, 3,10/*mean (0.211718), correlation (0.440606)*/,
		    4,1, 8,-4/*mean (0.213034), correlation (0.443177)*/,
		    -2,-2, 2,-13/*mean (0.234334), correlation (0.455304)*/,
		    2,-12, 12,12/*mean (0.235684), correlation (0.443436)*/,
		    -2,-13, 0,-6/*mean (0.237674), correlation (0.452525)*/,
		    4,1, 9,3/*mean (0.23962), correlation (0.444824)*/,
		    -6,-10, -3,-5/*mean (0.248459), correlation (0.439621)*/,
		    -3,-13, -1,1/*mean (0.249505), correlation (0.456666)*/,
		    7,5, 12,-11/*mean (0.00119208), correlation (0.495466)*/,
		    4,-2, 5,-7/*mean (0.00372245), correlation (0.484214)*/,
		    -13,9, -9,-5/*mean (0.00741116), correlation (0.499854)*/,
		    7,1, 8,6/*mean (0.0208952), correlation (0.499773)*/,
		    7,-8, 7,6/*mean (0.0220085), correlation (0.501609)*/,
		    -7,-4, -7,1/*mean (0.0233806), correlation (0.496568)*/,
		    -8,11, -7,-8/*mean (0.0236505), correlation (0.489719)*/,
		    -13,6, -12,-8/*mean (0.0268781), correlation (0.503487)*/,
		    2,4, 3,9/*mean (0.0323324), correlation (0.501938)*/,
		    10,-5, 12,3/*mean (0.0399235), correlation (0.494029)*/,
		    -6,-5, -6,7/*mean (0.0420153), correlation (0.486579)*/,
		    8,-3, 9,-8/*mean (0.0548021), correlation (0.484237)*/,
		    2,-12, 2,8/*mean (0.0616622), correlation (0.496642)*/,
		    -11,-2, -10,3/*mean (0.0627755), correlation (0.498563)*/,
		    -12,-13, -7,-9/*mean (0.0829622), correlation (0.495491)*/,
		    -11,0, -10,-5/*mean (0.0843342), correlation (0.487146)*/,
		    5,-3, 11,8/*mean (0.0929937), correlation (0.502315)*/,
		    -2,-13, -1,12/*mean (0.113327), correlation (0.48941)*/,
		    -1,-8, 0,9/*mean (0.132119), correlation (0.467268)*/,
		    -13,-11, -12,-5/*mean (0.136269), correlation (0.498771)*/,
		    -10,-2, -10,11/*mean (0.142173), correlation (0.498714)*/,
		    -3,9, -2,-13/*mean (0.144141), correlation (0.491973)*/,
		    2,-3, 3,2/*mean (0.14892), correlation (0.500782)*/,
		    -9,-13, -4,0/*mean (0.150371), correlation (0.498211)*/,
		    -4,6, -3,-10/*mean (0.152159), correlation (0.495547)*/,
		    -4,12, -2,-7/*mean (0.156152), correlation (0.496925)*/,
		    -6,-11, -4,9/*mean (0.15749), correlation (0.499222)*/,
		    6,-3, 6,11/*mean (0.159211), correlation (0.503821)*/,
		    -13,11, -5,5/*mean (0.162427), correlation (0.501907)*/,
		    11,11, 12,6/*mean (0.16652), correlation (0.497632)*/,
		    7,-5, 12,-2/*mean (0.169141), correlation (0.484474)*/,
		    -1,12, 0,7/*mean (0.169456), correlation (0.495339)*/,
		    -4,-8, -3,-2/*mean (0.171457), correlation (0.487251)*/,
		    -7,1, -6,7/*mean (0.175), correlation (0.500024)*/,
		    -13,-12, -8,-13/*mean (0.175866), correlation (0.497523)*/,
		    -7,-2, -6,-8/*mean (0.178273), correlation (0.501854)*/,
		    -8,5, -6,-9/*mean (0.181107), correlation (0.494888)*/,
		    -5,-1, -4,5/*mean (0.190227), correlation (0.482557)*/,
		    -13,7, -8,10/*mean (0.196739), correlation (0.496503)*/,
		    1,5, 5,-13/*mean (0.19973), correlation (0.499759)*/,
		    1,0, 10,-13/*mean (0.204465), correlation (0.49873)*/,
		    9,12, 10,-1/*mean (0.209334), correlation (0.49063)*/,
		    5,-8, 10,-9/*mean (0.211134), correlation (0.503011)*/,
		    -1,11, 1,-13/*mean (0.212), correlation (0.499414)*/,
		    -9,-3, -6,2/*mean (0.212168), correlation (0.480739)*/,
		    -1,-10, 1,12/*mean (0.212731), correlation (0.502523)*/,
		    -13,1, -8,-10/*mean (0.21327), correlation (0.489786)*/,
		    8,-11, 10,-6/*mean (0.214159), correlation (0.488246)*/,
		    2,-13, 3,-6/*mean (0.216993), correlation (0.50287)*/,
		    7,-13, 12,-9/*mean (0.223639), correlation (0.470502)*/,
		    -10,-10, -5,-7/*mean (0.224089), correlation (0.500852)*/,
		    -10,-8, -8,-13/*mean (0.228666), correlation (0.502629)*/,
		    4,-6, 8,5/*mean (0.22906), correlation (0.498305)*/,
		    3,12, 8,-13/*mean (0.233378), correlation (0.503825)*/,
		    -4,2, -3,-3/*mean (0.234323), correlation (0.476692)*/,
		    5,-13, 10,-12/*mean (0.236392), correlation (0.475462)*/,
		    4,-13, 5,-1/*mean (0.236842), correlation (0.504132)*/,
		    -9,9, -4,3/*mean (0.236977), correlation (0.497739)*/,
		    0,3, 3,-9/*mean (0.24314), correlation (0.499398)*/,
		    -12,1, -6,1/*mean (0.243297), correlation (0.489447)*/,
		    3,2, 4,-8/*mean (0.00155196), correlation (0.553496)*/,
		    -10,-10, -10,9/*mean (0.00239541), correlation (0.54297)*/,
		    8,-13, 12,12/*mean (0.0034413), correlation (0.544361)*/,
		    -8,-12, -6,-5/*mean (0.003565), correlation (0.551225)*/,
		    2,2, 3,7/*mean (0.00835583), correlation (0.55285)*/,
		    10,6, 11,-8/*mean (0.00885065), correlation (0.540913)*/,
		    6,8, 8,-12/*mean (0.0101552), correlation (0.551085)*/,
		    -7,10, -6,5/*mean (0.0102227), correlation (0.533635)*/,
		    -3,-9, -3,9/*mean (0.0110211), correlation (0.543121)*/,
		    -1,-13, -1,5/*mean (0.0113473), correlation (0.550173)*/,
		    -3,-7, -3,4/*mean (0.0140913), correlation (0.554774)*/,
		    -8,-2, -8,3/*mean (0.017049), correlation (0.55461)*/,
		    4,2, 12,12/*mean (0.01778), correlation (0.546921)*/,
		    2,-5, 3,11/*mean (0.0224022), correlation (0.549667)*/,
		    6,-9, 11,-13/*mean (0.029161), correlation (0.546295)*/,
		    3,-1, 7,12/*mean (0.0303081), correlation (0.548599)*/,
		    11,-1, 12,4/*mean (0.0355151), correlation (0.523943)*/,
		    -3,0, -3,6/*mean (0.0417904), correlation (0.543395)*/,
		    4,-11, 4,12/*mean (0.0487292), correlation (0.542818)*/,
		    2,-4, 2,1/*mean (0.0575124), correlation (0.554888)*/,
		    -10,-6, -8,1/*mean (0.0594242), correlation (0.544026)*/,
		    -13,7, -11,1/*mean (0.0597391), correlation (0.550524)*/,
		    -13,12, -11,-13/*mean (0.0608974), correlation (0.55383)*/,
		    6,0, 11,-13/*mean (0.065126), correlation (0.552006)*/,
		    0,-1, 1,4/*mean (0.074224), correlation (0.546372)*/,
		    -13,3, -9,-2/*mean (0.0808592), correlation (0.554875)*/,
		    -9,8, -6,-3/*mean (0.0883378), correlation (0.551178)*/,
		    -13,-6, -8,-2/*mean (0.0901035), correlation (0.548446)*/,
		    5,-9, 8,10/*mean (0.0949843), correlation (0.554694)*/,
		    2,7, 3,-9/*mean (0.0994152), correlation (0.550979)*/,
		    -1,-6, -1,-1/*mean (0.10045), correlation (0.552714)*/,
		    9,5, 11,-2/*mean (0.100686), correlation (0.552594)*/,
		    11,-3, 12,-8/*mean (0.101091), correlation (0.532394)*/,
		    3,0, 3,5/*mean (0.101147), correlation (0.525576)*/,
		    -1,4, 0,10/*mean (0.105263), correlation (0.531498)*/,
		    3,-6, 4,5/*mean (0.110785), correlation (0.540491)*/,
		    -13,0, -10,5/*mean (0.112798), correlation (0.536582)*/,
		    5,8, 12,11/*mean (0.114181), correlation (0.555793)*/,
		    8,9, 9,-6/*mean (0.117431), correlation (0.553763)*/,
		    7,-4, 8,-12/*mean (0.118522), correlation (0.553452)*/,
		    -10,4, -10,9/*mean (0.12094), correlation (0.554785)*/,
		    7,3, 12,4/*mean (0.122582), correlation (0.555825)*/,
		    9,-7, 10,-2/*mean (0.124978), correlation (0.549846)*/,
		    7,0, 12,-2/*mean (0.127002), correlation (0.537452)*/,
		    -1,-6, 0,-11/*mean (0.127148), correlation (0.547401)*/
		]);

	    var H = new jsfeat.matrix_t(3, 3, jsfeat.F32_t|jsfeat.C1_t);
	    var patch_img = new jsfeat.matrix_t(32, 32, jsfeat.U8_t|jsfeat.C1_t);

	    var rectify_patch = function(src, dst, angle, px, py, psize) {
	    	var cosine = Math.cos(angle);
	    	var sine   = Math.sin(angle);

	        H.data[0] = cosine, H.data[1] = -sine,    H.data[2] = (-cosine + sine  ) * psize*0.5 + px,
	        H.data[3] = sine,   H.data[4] =  cosine,  H.data[5] = (-sine   - cosine) * psize*0.5 + py;

	        jsfeat.imgproc.warp_affine(src, dst, H, 128);
	    }

    	return {

    		describe: function(src, corners, count, descriptors) {
    			var DESCR_SIZE = 32; // bytes;
				var i=0,b=0,px=0.0,py=0.0,angle=0.0;
				var t0=0, t1=0, val=0;
				var img = src.data, w = src.cols, h = src.rows;
				var patch_d = patch_img.data;
				var patch_off = 16*32 + 16; // center of patch
				var patt=0;

				if(!(descriptors.type&jsfeat.U8_t)) {
					// relocate to U8 type
					descriptors.type = jsfeat.U8_t;
					descriptors.cols = DESCR_SIZE;
	                descriptors.rows = count;
	                descriptors.channel = 1;
					descriptors.allocate();
				} else {
					descriptors.resize(DESCR_SIZE, count, 1);
				}

				var descr_d = descriptors.data;
				var descr_off = 0;

				for(i = 0; i < count; ++i) {
					px = corners[i].x;
					py = corners[i].y;
					angle = corners[i].angle;

					rectify_patch(src, patch_img, angle, px, py, 32);

					// describe the patch
					patt = 0;
					for (b = 0; b < DESCR_SIZE; ++b) {
			            
			            t0 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            t1 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            val = (t0 < t1)|0;
			            
			            t0 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            t1 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            val |= (t0 < t1) << 1;
			            
			            t0 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            t1 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            val |= (t0 < t1) << 2;
			            
			            t0 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            t1 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            val |= (t0 < t1) << 3;
			            
			            t0 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            t1 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            val |= (t0 < t1) << 4;
			            
			            t0 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            t1 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            val |= (t0 < t1) << 5;
			            
			            t0 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            t1 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            val |= (t0 < t1) << 6;
			            
			            t0 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            t1 = patch_d[patch_off + bit_pattern_31_[patt+1] * 32 + bit_pattern_31_[patt]]; patt += 2
			            val |= (t0 < t1) << 7;
			            
			            descr_d[descr_off+b] = val;
			        }
			        descr_off += DESCR_SIZE;
				}
    		}
    	};
    })();

    global.orb = orb;

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 *
 * this code is a rewrite from OpenCV's Lucas-Kanade optical flow implementation
 */

(function(global) {
    "use strict";
    //
    var optical_flow_lk = (function() {

        // short link to shar deriv
        var scharr_deriv = jsfeat.imgproc.scharr_derivatives;

        return {
            track: function(prev_pyr, curr_pyr, prev_xy, curr_xy, count, win_size, max_iter, status, eps, min_eigen_threshold) {
                if (typeof max_iter === "undefined") { max_iter = 30; }
                if (typeof status === "undefined") { status = new Uint8Array(count); }
                if (typeof eps === "undefined") { eps = 0.01; }
                if (typeof min_eigen_threshold === "undefined") { min_eigen_threshold = 0.0001; }

                var half_win = (win_size-1)*0.5;
                var win_area = (win_size*win_size)|0;
                var win_area2 = win_area << 1;
                var prev_imgs = prev_pyr.data, next_imgs = curr_pyr.data;
                var img_prev=prev_imgs[0].data,img_next=next_imgs[0].data;
                var w0 = prev_imgs[0].cols, h0 = prev_imgs[0].rows,lw=0,lh=0;

                var iwin_node = jsfeat.cache.get_buffer(win_area<<2);
                var deriv_iwin_node = jsfeat.cache.get_buffer(win_area2<<2);
                var deriv_lev_node = jsfeat.cache.get_buffer((h0*(w0<<1))<<2);

                var deriv_m = new jsfeat.matrix_t(w0, h0, jsfeat.S32C2_t, deriv_lev_node.data);

                var iwin_buf = iwin_node.i32;
                var deriv_iwin = deriv_iwin_node.i32;
                var deriv_lev = deriv_lev_node.i32;

                var dstep=0,src=0,dsrc=0,iptr=0,diptr=0,jptr=0;
                var lev_sc=0.0,prev_x=0.0,prev_y=0.0,next_x=0.0,next_y=0.0;
                var prev_delta_x=0.0,prev_delta_y=0.0,delta_x=0.0,delta_y=0.0;
                var iprev_x=0,iprev_y=0,inext_x=0,inext_y=0;
                var i=0,j=0,x=0,y=0,level=0,ptid=0,iter=0;
                var brd_tl=0,brd_r=0,brd_b=0;
                var a=0.0,b=0.0,b1=0.0,b2=0.0;

                // fixed point math
                var W_BITS14 = 14;
                var W_BITS4 = 14;
                var W_BITS1m5 = W_BITS4 - 5;
                var W_BITS1m51 = (1 << ((W_BITS1m5) - 1));
                var W_BITS14_ = (1 << W_BITS14);
                var W_BITS41 = (1 << ((W_BITS4) - 1));
                var FLT_SCALE = 1.0/(1 << 20);
                var iw00=0,iw01=0,iw10=0,iw11=0,ival=0,ixval=0,iyval=0;
                var A11=0.0,A12=0.0,A22=0.0,D=0.0,min_eig=0.0;

                var FLT_EPSILON = 0.00000011920929;
                eps *= eps;

                // reset status
                for(; i < count; ++i) {
                    status[i] = 1;
                }

                var max_level = (prev_pyr.levels - 1)|0;
                level = max_level;

                for(; level >= 0; --level) {
                    lev_sc = (1.0/(1 << level));
                    lw = w0 >> level;
                    lh = h0 >> level;
                    dstep = lw << 1;
                    img_prev = prev_imgs[level].data;
                    img_next = next_imgs[level].data;
                    
                    brd_r = (lw - win_size)|0;
                    brd_b = (lh - win_size)|0;

                    // calculate level derivatives
                    scharr_deriv(prev_imgs[level], deriv_m);

                    // iterate through points
                    for(ptid = 0; ptid < count; ++ptid) {
                        i = ptid << 1;
                        j = i + 1;
                        prev_x = prev_xy[i]*lev_sc;
                        prev_y = prev_xy[j]*lev_sc;

                        if( level == max_level ) {
                            next_x = prev_x;
                            next_y = prev_y;
                        } else {
                            next_x = curr_xy[i]*2.0;
                            next_y = curr_xy[j]*2.0;
                        }
                        curr_xy[i] = next_x;
                        curr_xy[j] = next_y;

                        prev_x -= half_win;
                        prev_y -= half_win;
                        iprev_x = prev_x|0;
                        iprev_y = prev_y|0;

                        // border check
                        x = (iprev_x <= brd_tl)|(iprev_x >= brd_r)|(iprev_y <= brd_tl)|(iprev_y >= brd_b);
                        if( x != 0 ) {
                            if( level == 0 ) {
                                status[ptid] = 0;
                            }
                            continue;
                        }

                        a = prev_x - iprev_x;
                        b = prev_y - iprev_y;
                        iw00 = (((1.0 - a)*(1.0 - b)*W_BITS14_) + 0.5)|0;
                        iw01 = ((a*(1.0 - b)*W_BITS14_) + 0.5)|0;
                        iw10 = (((1.0 - a)*b*W_BITS14_) + 0.5)|0;
                        iw11 = (W_BITS14_ - iw00 - iw01 - iw10);

                        A11 = 0.0, A12 = 0.0, A22 = 0.0;

                        // extract the patch from the first image, compute covariation matrix of derivatives
                        for( y = 0; y < win_size; ++y ) {
                            src = ( (y + iprev_y)*lw + iprev_x )|0;
                            dsrc = src << 1;

                            iptr = (y*win_size)|0;
                            diptr = iptr << 1;
                            for(x = 0 ; x < win_size; ++x, ++src, ++iptr, dsrc += 2) {
                                ival = ( (img_prev[src])*iw00 + (img_prev[src+1])*iw01 +
                                        (img_prev[src+lw])*iw10 + (img_prev[src+lw+1])*iw11 );
                                ival = (((ival) + W_BITS1m51) >> (W_BITS1m5));

                                ixval = ( deriv_lev[dsrc]*iw00 + deriv_lev[dsrc+2]*iw01 +
                                        deriv_lev[dsrc+dstep]*iw10 + deriv_lev[dsrc+dstep+2]*iw11 );
                                ixval = (((ixval) + W_BITS41) >> (W_BITS4));

                                iyval = ( deriv_lev[dsrc+1]*iw00 + deriv_lev[dsrc+3]*iw01 + deriv_lev[dsrc+dstep+1]*iw10 +
                                        deriv_lev[dsrc+dstep+3]*iw11 );
                                iyval = (((iyval) + W_BITS41) >> (W_BITS4));

                                iwin_buf[iptr] = ival;
                                deriv_iwin[diptr++] = ixval;
                                deriv_iwin[diptr++] = iyval;

                                A11 += ixval*ixval;
                                A12 += ixval*iyval;
                                A22 += iyval*iyval;
                            }
                        }

                        A11 *= FLT_SCALE; A12 *= FLT_SCALE; A22 *= FLT_SCALE;

                        D = A11*A22 - A12*A12;
                        min_eig = (A22 + A11 - Math.sqrt((A11-A22)*(A11-A22) + 4.0*A12*A12)) / win_area2;

                        if( min_eig < min_eigen_threshold || D < FLT_EPSILON )
                        {
                            if( level == 0 ) {
                                status[ptid] = 0;
                            }
                            continue;
                        }

                        D = 1.0/D;

                        next_x -= half_win;
                        next_y -= half_win;
                        prev_delta_x = 0.0;
                        prev_delta_y = 0.0;

                        for( iter = 0; iter < max_iter; ++iter ) {
                            inext_x = next_x|0;
                            inext_y = next_y|0;

                            x = (inext_x <= brd_tl)|(inext_x >= brd_r)|(inext_y <= brd_tl)|(inext_y >= brd_b);
                            if( x != 0 ) {
                                if( level == 0 ) {
                                    status[ptid] = 0;
                                }
                                break;
                            }

                            a = next_x - inext_x;
                            b = next_y - inext_y;
                            iw00 = (((1.0 - a)*(1.0 - b)*W_BITS14_) + 0.5)|0;
                            iw01 = ((a*(1.0 - b)*W_BITS14_) + 0.5)|0;
                            iw10 = (((1.0 - a)*b*W_BITS14_) + 0.5)|0;
                            iw11 = (W_BITS14_ - iw00 - iw01 - iw10);
                            b1 = 0.0, b2 = 0.0;

                            for( y = 0; y < win_size; ++y ) {
                                jptr = ( (y + inext_y)*lw + inext_x )|0;

                                iptr = (y*win_size)|0;
                                diptr = iptr << 1;
                                for( x = 0 ; x < win_size; ++x, ++jptr, ++iptr ) {
                                    ival = ( (img_next[jptr])*iw00 + (img_next[jptr+1])*iw01 +
                                            (img_next[jptr+lw])*iw10 + (img_next[jptr+lw+1])*iw11 );
                                    ival = (((ival) + W_BITS1m51) >> (W_BITS1m5));
                                    ival = (ival - iwin_buf[iptr]);

                                    b1 += ival * deriv_iwin[diptr++];
                                    b2 += ival * deriv_iwin[diptr++];
                                }
                            }

                            b1 *= FLT_SCALE;
                            b2 *= FLT_SCALE;

                            delta_x = ((A12*b2 - A22*b1) * D);
                            delta_y = ((A12*b1 - A11*b2) * D);

                            next_x += delta_x;
                            next_y += delta_y;
                            curr_xy[i] = next_x + half_win;
                            curr_xy[j] = next_y + half_win;

                            if( delta_x*delta_x + delta_y*delta_y <= eps ) {
                                break;
                            }

                            if( iter > 0 && Math.abs(delta_x + prev_delta_x) < 0.01 &&
                                            Math.abs(delta_y + prev_delta_y) < 0.01 ) {
                                curr_xy[i] -= delta_x*0.5;
                                curr_xy[j] -= delta_y*0.5;
                                break;
                            }

                            prev_delta_x = delta_x;
                            prev_delta_y = delta_y;
                        }
                    } // points loop
                } // levels loop

                jsfeat.cache.put_buffer(iwin_node);
                jsfeat.cache.put_buffer(deriv_iwin_node);
                jsfeat.cache.put_buffer(deriv_lev_node);
            }
        };
    })();

    global.optical_flow_lk = optical_flow_lk;

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 *
 * this code is a rewrite from https://github.com/mtschirs/js-objectdetect implementation
 * @author Martin Tschirsich / http://www.tu-darmstadt.de/~m_t
 */

(function(global) {
    "use strict";
    //
    var haar = (function() {

        var _group_func = function(r1, r2) {
            var distance = (r1.width * 0.25 + 0.5)|0;

            return r2.x <= r1.x + distance &&
                   r2.x >= r1.x - distance &&
                   r2.y <= r1.y + distance &&
                   r2.y >= r1.y - distance &&
                   r2.width <= (r1.width * 1.5 + 0.5)|0 &&
                   (r2.width * 1.5 + 0.5)|0 >= r1.width;
        }
        
        return {

            edges_density: 0.07,

            detect_single_scale: function(int_sum, int_sqsum, int_tilted, int_canny_sum, width, height, scale, classifier) {
                var win_w = (classifier.size[0] * scale)|0,
                    win_h = (classifier.size[1] * scale)|0,
                    step_x = (0.5 * scale + 1.5)|0,
                    step_y = step_x;
                var i,j,k,x,y,ex=(width-win_w)|0,ey=(height-win_h)|0;
                var w1=(width+1)|0,edge_dens,mean,variance,std;
                var inv_area = 1.0 / (win_w * win_h);
                var stages,stage,trees,tree,sn,tn,fn,found=true,stage_thresh,stage_sum,tree_sum,feature,features;
                var fi_a,fi_b,fi_c,fi_d,fw,fh;

                var ii_a=0,ii_b=win_w,ii_c=win_h*w1,ii_d=ii_c+win_w;
                var edges_thresh = ((win_w*win_h) * 0xff * this.edges_density)|0;
                // if too much gradient we also can skip
                //var edges_thresh_high = ((win_w*win_h) * 0xff * 0.3)|0;

                var rects = [];
                for(y = 0; y < ey; y += step_y) {
                    ii_a = y * w1;
                    for(x = 0; x < ex; x += step_x, ii_a += step_x) {

                        mean =    int_sum[ii_a] 
                                - int_sum[ii_a+ii_b]
                                - int_sum[ii_a+ii_c]
                                + int_sum[ii_a+ii_d];

                        // canny prune
                        if(int_canny_sum) {
                            edge_dens = (int_canny_sum[ii_a] 
                                        - int_canny_sum[ii_a+ii_b]
                                        - int_canny_sum[ii_a+ii_c]
                                        + int_canny_sum[ii_a+ii_d]);
                            if(edge_dens < edges_thresh || mean < 20) {
                                x += step_x, ii_a += step_x;
                                continue;
                            }
                        }

                        mean *= inv_area;
                        variance = (int_sqsum[ii_a] 
                                    - int_sqsum[ii_a+ii_b]
                                    - int_sqsum[ii_a+ii_c]
                                    + int_sqsum[ii_a+ii_d]) * inv_area - mean * mean;

                        std = variance > 0. ? Math.sqrt(variance) : 1;

                        stages = classifier.complexClassifiers;
                        sn = stages.length;
                        found =  true;
                        for(i = 0; i < sn; ++i) {
                            stage = stages[i];
                            stage_thresh = stage.threshold;
                            trees = stage.simpleClassifiers;
                            tn = trees.length;
                            stage_sum = 0;
                            for(j = 0; j < tn; ++j) {
                                tree = trees[j];
                                tree_sum = 0;
                                features = tree.features;
                                fn = features.length;
                                if(tree.tilted === 1) {
                                    for(k=0; k < fn; ++k) {
                                        feature = features[k];
                                        fi_a = ~~(x + feature[0] * scale) + ~~(y + feature[1] * scale) * w1;
                                        fw = ~~(feature[2] * scale);
                                        fh = ~~(feature[3] * scale);
                                        fi_b = fw * w1;
                                        fi_c =  fh * w1;

                                        tree_sum += (int_tilted[fi_a]
                                                    - int_tilted[fi_a + fw + fi_b]
                                                    - int_tilted[fi_a - fh + fi_c]
                                                    + int_tilted[fi_a + fw - fh + fi_b + fi_c]) * feature[4];
                                    }
                                } else {
                                    for(k=0; k < fn; ++k) {
                                        feature = features[k];
                                        fi_a = ~~(x + feature[0] * scale) + ~~(y + feature[1] * scale) * w1;
                                        fw = ~~(feature[2] * scale);
                                        fh = ~~(feature[3] * scale);
                                        fi_c = fh * w1;

                                        tree_sum += (int_sum[fi_a] 
                                                    - int_sum[fi_a+fw]
                                                    - int_sum[fi_a+fi_c]
                                                    + int_sum[fi_a+fi_c+fw]) * feature[4];
                                    }
                                }
                                stage_sum += (tree_sum * inv_area < tree.threshold * std) ? tree.left_val : tree.right_val;
                            }
                            if (stage_sum < stage_thresh) {
                                found = false;
                                break;
                            }
                        }
                        
                        if(found) {
                            rects.push({"x" : x,
                                        "y" : y,
                                        "width" : win_w,
                                        "height" : win_h,
                                        "neighbor" : 1,
                                        "confidence" : stage_sum});
                            x += step_x, ii_a += step_x;
                        }
                    }
                }
                return rects;
            },

            detect_multi_scale: function(int_sum, int_sqsum, int_tilted, int_canny_sum, width, height, classifier, scale_factor, scale_min) {
                if (typeof scale_factor === "undefined") { scale_factor = 1.2; }
                if (typeof scale_min === "undefined") { scale_min = 1.0; }
                var win_w = classifier.size[0];
                var win_h = classifier.size[1];
                var rects = [];
                while (scale_min * win_w < width && scale_min * win_h < height) {
                    rects = rects.concat(this.detect_single_scale(int_sum, int_sqsum, int_tilted, int_canny_sum, width, height, scale_min, classifier));
                    scale_min *= scale_factor;
                }
                return rects;
            },

            // OpenCV method to group detected rectangles
            group_rectangles: function(rects, min_neighbors) {
                if (typeof min_neighbors === "undefined") { min_neighbors = 1; }
                var i, j, n = rects.length;
                var node = [];
                for (i = 0; i < n; ++i) {
                    node[i] = {"parent" : -1,
                               "element" : rects[i],
                               "rank" : 0};
                }
                for (i = 0; i < n; ++i) {
                    if (!node[i].element)
                        continue;
                    var root = i;
                    while (node[root].parent != -1)
                        root = node[root].parent;
                    for (j = 0; j < n; ++j) {
                        if( i != j && node[j].element && _group_func(node[i].element, node[j].element)) {
                            var root2 = j;

                            while (node[root2].parent != -1)
                                root2 = node[root2].parent;

                            if(root2 != root) {
                                if(node[root].rank > node[root2].rank)
                                    node[root2].parent = root;
                                else {
                                    node[root].parent = root2;
                                    if (node[root].rank == node[root2].rank)
                                    node[root2].rank++;
                                    root = root2;
                                }

                                /* compress path from node2 to the root: */
                                var temp, node2 = j;
                                while (node[node2].parent != -1) {
                                    temp = node2;
                                    node2 = node[node2].parent;
                                    node[temp].parent = root;
                                }

                                /* compress path from node to the root: */
                                node2 = i;
                                while (node[node2].parent != -1) {
                                    temp = node2;
                                    node2 = node[node2].parent;
                                    node[temp].parent = root;
                                }
                            }
                        }
                    }
                }
                var idx_seq = [];
                var class_idx = 0;
                for(i = 0; i < n; i++) {
                    j = -1;
                    var node1 = i;
                    if(node[node1].element) {
                        while (node[node1].parent != -1)
                            node1 = node[node1].parent;
                        if(node[node1].rank >= 0)
                            node[node1].rank = ~class_idx++;
                        j = ~node[node1].rank;
                    }
                    idx_seq[i] = j;
                }
                
                var comps = [];
                for (i = 0; i < class_idx+1; ++i) {
                    comps[i] = {"neighbors" : 0,
                                "x" : 0,
                                "y" : 0,
                                "width" : 0,
                                "height" : 0,
                                "confidence" : 0};
                }

                // count number of neighbors
                for(i = 0; i < n; ++i) {
                    var r1 = rects[i];
                    var idx = idx_seq[i];

                    if (comps[idx].neighbors == 0)
                        comps[idx].confidence = r1.confidence;

                    ++comps[idx].neighbors;

                    comps[idx].x += r1.x;
                    comps[idx].y += r1.y;
                    comps[idx].width += r1.width;
                    comps[idx].height += r1.height;
                    comps[idx].confidence = Math.max(comps[idx].confidence, r1.confidence);
                }

                var seq2 = [];
                // calculate average bounding box
                for(i = 0; i < class_idx; ++i) {
                    n = comps[i].neighbors;
                    if (n >= min_neighbors)
                        seq2.push({"x" : (comps[i].x * 2 + n) / (2 * n),
                                   "y" : (comps[i].y * 2 + n) / (2 * n),
                                   "width" : (comps[i].width * 2 + n) / (2 * n),
                                   "height" : (comps[i].height * 2 + n) / (2 * n),
                                   "neighbors" : comps[i].neighbors,
                                   "confidence" : comps[i].confidence});
                }

                var result_seq = [];
                n = seq2.length;
                // filter out small face rectangles inside large face rectangles
                for(i = 0; i < n; ++i) {
                    var r1 = seq2[i];
                    var flag = true;
                    for(j = 0; j < n; ++j) {
                        var r2 = seq2[j];
                        var distance = (r2.width * 0.25 + 0.5)|0;

                        if(i != j &&
                           r1.x >= r2.x - distance &&
                           r1.y >= r2.y - distance &&
                           r1.x + r1.width <= r2.x + r2.width + distance &&
                           r1.y + r1.height <= r2.y + r2.height + distance &&
                           (r2.neighbors > Math.max(3, r1.neighbors) || r1.neighbors < 3)) {
                            flag = false;
                            break;
                        }
                    }

                    if(flag)
                        result_seq.push(r1);
                }
                return result_seq;
            }
        };

    })();

    global.haar = haar;

})(jsfeat);
/**
 * BBF: Brightness Binary Feature
 *
 * @author Eugene Zatepyakin / http://inspirit.ru/
 *
 * this code is a rewrite from https://github.com/liuliu/ccv implementation
 * @author Liu Liu / http://liuliu.me/
 *
 * The original paper refers to: YEF∗ Real-Time Object Detection, Yotam Abramson and Bruno Steux
 */

(function(global) {
    "use strict";
    //
    var bbf = (function() {

        var _group_func = function(r1, r2) {
            var distance = (r1.width * 0.25 + 0.5)|0;

            return r2.x <= r1.x + distance &&
                   r2.x >= r1.x - distance &&
                   r2.y <= r1.y + distance &&
                   r2.y >= r1.y - distance &&
                   r2.width <= (r1.width * 1.5 + 0.5)|0 &&
                   (r2.width * 1.5 + 0.5)|0 >= r1.width;
        }

        var img_pyr = new jsfeat.pyramid_t(1);

        return {

            interval: 4,
            scale: 1.1486,
            next: 5,
            scale_to: 1,

            // make features local copy
            // to avoid array allocation with each scale
            // this is strange but array works faster than Int32 version???
            prepare_cascade: function(cascade) {
                var sn = cascade.stage_classifier.length;
                for (var j = 0; j < sn; j++) {
                    var orig_feature = cascade.stage_classifier[j].feature;
                    var f_cnt = cascade.stage_classifier[j].count;
                    var feature = cascade.stage_classifier[j]._feature = new Array(f_cnt);
                    for (var k = 0; k < f_cnt; k++) {
                        feature[k] = {"size" : orig_feature[k].size,
                                      "px" : new Array(orig_feature[k].size),
                                      "pz" : new Array(orig_feature[k].size),
                                      "nx" : new Array(orig_feature[k].size),
                                      "nz" : new Array(orig_feature[k].size)};
                    }
                }
            },

            build_pyramid: function(src, min_width, min_height, interval) {
                if (typeof interval === "undefined") { interval = 4; }

                var sw=src.cols,sh=src.rows;
                var i=0,nw=0,nh=0;
                var new_pyr=false;
                var src0=src,src1=src;
                var data_type = jsfeat.U8_t | jsfeat.C1_t;

                this.interval = interval;
                this.scale = Math.pow(2, 1 / (this.interval + 1));
                this.next = (this.interval + 1)|0;
                this.scale_to = (Math.log(Math.min(sw / min_width, sh / min_height)) / Math.log(this.scale))|0;

                var pyr_l = ((this.scale_to + this.next * 2) * 4) | 0;
                if(img_pyr.levels != pyr_l) {
                    img_pyr.levels = pyr_l;
                    img_pyr.data = new Array(pyr_l);
                    new_pyr = true;
                    img_pyr.data[0] = src; // first is src
                }

                for (i = 1; i <= this.interval; ++i) {
                    nw = (sw / Math.pow(this.scale, i))|0;
                    nh = (sh / Math.pow(this.scale, i))|0;
                    src0 = img_pyr.data[i<<2];
                    if(new_pyr || nw != src0.cols || nh != src0.rows) {
                        img_pyr.data[i<<2] = new jsfeat.matrix_t(nw, nh, data_type);
                        src0 = img_pyr.data[i<<2];
                    }
                    jsfeat.imgproc.resample(src, src0, nw, nh);
                }
                for (i = this.next; i < this.scale_to + this.next * 2; ++i) {
                    src1 = img_pyr.data[(i << 2) - (this.next << 2)];
                    src0 = img_pyr.data[i<<2];
                    nw = src1.cols >> 1;
                    nh = src1.rows >> 1;
                    if(new_pyr || nw != src0.cols || nh != src0.rows) {
                        img_pyr.data[i<<2] = new jsfeat.matrix_t(nw, nh, data_type);
                        src0 = img_pyr.data[i<<2];
                    }
                    jsfeat.imgproc.pyrdown(src1, src0);
                }
                for (i = this.next * 2; i < this.scale_to + this.next * 2; ++i) {
                    src1 = img_pyr.data[(i << 2) - (this.next << 2)];
                    nw = src1.cols >> 1;
                    nh = src1.rows >> 1;
                    src0 = img_pyr.data[(i<<2)+1];
                    if(new_pyr || nw != src0.cols || nh != src0.rows) {
                        img_pyr.data[(i<<2)+1] = new jsfeat.matrix_t(nw, nh, data_type);
                        src0 = img_pyr.data[(i<<2)+1];
                    }
                    jsfeat.imgproc.pyrdown(src1, src0, 1, 0);
                    //
                    src0 = img_pyr.data[(i<<2)+2];
                    if(new_pyr || nw != src0.cols || nh != src0.rows) {
                        img_pyr.data[(i<<2)+2] = new jsfeat.matrix_t(nw, nh, data_type);
                        src0 = img_pyr.data[(i<<2)+2];
                    }
                    jsfeat.imgproc.pyrdown(src1, src0, 0, 1);
                    //
                    src0 = img_pyr.data[(i<<2)+3];
                    if(new_pyr || nw != src0.cols || nh != src0.rows) {
                        img_pyr.data[(i<<2)+3] = new jsfeat.matrix_t(nw, nh, data_type);
                        src0 = img_pyr.data[(i<<2)+3];
                    }
                    jsfeat.imgproc.pyrdown(src1, src0, 1, 1);
                }
                return img_pyr;
            },

            detect: function(pyramid, cascade) {
                var interval = this.interval;
                var scale = this.scale;
                var next = this.next;
                var scale_upto = this.scale_to;
                var i=0,j=0,k=0,n=0,x=0,y=0,q=0,sn=0,f_cnt=0,q_cnt=0,p=0,pmin=0,nmax=0,f=0,i4=0,qw=0,qh=0;
                var sum=0.0, alpha, feature, orig_feature, feature_k, feature_o, flag = true, shortcut=true;
                var scale_x = 1.0, scale_y = 1.0;
                var dx = [0, 1, 0, 1];
                var dy = [0, 0, 1, 1];
                var seq = [];
                var pyr=pyramid.data, bpp = 1, bpp2 = 2, bpp4 = 4;

                var u8 = [], u8o = [0,0,0];
                var step = [0,0,0];
                var paddings = [0,0,0];

                for (i = 0; i < scale_upto; i++) {
                    i4 = (i<<2);
                    qw = pyr[i4 + (next << 3)].cols - (cascade.width >> 2);
                    qh = pyr[i4 + (next << 3)].rows - (cascade.height >> 2);
                    step[0] = pyr[i4].cols * bpp;
                    step[1] = pyr[i4 + (next << 2)].cols * bpp;
                    step[2] = pyr[i4 + (next << 3)].cols * bpp;
                    paddings[0] = (pyr[i4].cols * bpp4) - (qw * bpp4);
                    paddings[1] = (pyr[i4 + (next << 2)].cols * bpp2) - (qw * bpp2);
                    paddings[2] = (pyr[i4 + (next << 3)].cols * bpp) - (qw * bpp);
                    sn = cascade.stage_classifier.length;
                    for (j = 0; j < sn; j++) {
                        orig_feature = cascade.stage_classifier[j].feature;
                        feature = cascade.stage_classifier[j]._feature;
                        f_cnt = cascade.stage_classifier[j].count;
                        for (k = 0; k < f_cnt; k++) {
                            feature_k = feature[k];
                            feature_o = orig_feature[k];
                            q_cnt = feature_o.size|0;
                            for (q = 0; q < q_cnt; q++) {
                                feature_k.px[q] = (feature_o.px[q] * bpp) + feature_o.py[q] * step[feature_o.pz[q]];
                                feature_k.pz[q] = feature_o.pz[q];
                                feature_k.nx[q] = (feature_o.nx[q] * bpp) + feature_o.ny[q] * step[feature_o.nz[q]];
                                feature_k.nz[q] = feature_o.nz[q];
                            }
                        }
                    }
                    u8[0] = pyr[i4].data; u8[1] = pyr[i4 + (next<<2)].data;
                    for (q = 0; q < 4; q++) {
                        u8[2] = pyr[i4 + (next<<3) + q].data;
                        u8o[0] = (dx[q]*bpp2) + dy[q] * (pyr[i4].cols*bpp2); 
                        u8o[1] = (dx[q]*bpp) + dy[q] * (pyr[i4 + (next<<2)].cols*bpp); 
                        u8o[2] = 0;
                        for (y = 0; y < qh; y++) {
                            for (x = 0; x < qw; x++) {
                                sum = 0;
                                flag = true;
                                sn = cascade.stage_classifier.length;
                                for (j = 0; j < sn; j++) {
                                    sum = 0;
                                    alpha = cascade.stage_classifier[j].alpha;
                                    feature = cascade.stage_classifier[j]._feature;
                                    f_cnt = cascade.stage_classifier[j].count;
                                    for (k = 0; k < f_cnt; k++) {
                                        feature_k = feature[k];
                                        pmin = u8[feature_k.pz[0]][u8o[feature_k.pz[0]] + feature_k.px[0]];
                                        nmax = u8[feature_k.nz[0]][u8o[feature_k.nz[0]] + feature_k.nx[0]];
                                        if (pmin <= nmax) {
                                            sum += alpha[k << 1];
                                        } else {
                                            shortcut = true;
                                            q_cnt = feature_k.size;
                                            for (f = 1; f < q_cnt; f++) {
                                                if (feature_k.pz[f] >= 0) {
                                                    p = u8[feature_k.pz[f]][u8o[feature_k.pz[f]] + feature_k.px[f]];
                                                    if (p < pmin) {
                                                        if (p <= nmax) {
                                                            shortcut = false;
                                                            break;
                                                        }
                                                        pmin = p;
                                                    }
                                                }
                                                if (feature_k.nz[f] >= 0) {
                                                    n = u8[feature_k.nz[f]][u8o[feature_k.nz[f]] + feature_k.nx[f]];
                                                    if (n > nmax) {
                                                        if (pmin <= n) {
                                                            shortcut = false;
                                                            break;
                                                        }
                                                        nmax = n;
                                                    }
                                                }
                                            }
                                            sum += (shortcut) ? alpha[(k << 1) + 1] : alpha[k << 1];
                                        }
                                    }
                                    if (sum < cascade.stage_classifier[j].threshold) {
                                        flag = false;
                                        break;
                                    }
                                }
                                if (flag) {
                                    seq.push({"x" : (x * 4 + dx[q] * 2) * scale_x,
                                              "y" : (y * 4 + dy[q] * 2) * scale_y,
                                              "width" : cascade.width * scale_x,
                                              "height" : cascade.height * scale_y,
                                              "neighbor" : 1,
                                              "confidence" : sum});
                                    ++x;
                                    u8o[0] += bpp4;
                                    u8o[1] += bpp2;
                                    u8o[2] += bpp;
                                }
                                u8o[0] += bpp4;
                                u8o[1] += bpp2;
                                u8o[2] += bpp;
                            }
                            u8o[0] += paddings[0];
                            u8o[1] += paddings[1];
                            u8o[2] += paddings[2];
                        }
                    }
                    scale_x *= scale;
                    scale_y *= scale;
                }

                return seq;
            },

            // OpenCV method to group detected rectangles
            group_rectangles: function(rects, min_neighbors) {
                if (typeof min_neighbors === "undefined") { min_neighbors = 1; }
                var i, j, n = rects.length;
                var node = [];
                for (i = 0; i < n; ++i) {
                    node[i] = {"parent" : -1,
                               "element" : rects[i],
                               "rank" : 0};
                }
                for (i = 0; i < n; ++i) {
                    if (!node[i].element)
                        continue;
                    var root = i;
                    while (node[root].parent != -1)
                        root = node[root].parent;
                    for (j = 0; j < n; ++j) {
                        if( i != j && node[j].element && _group_func(node[i].element, node[j].element)) {
                            var root2 = j;

                            while (node[root2].parent != -1)
                                root2 = node[root2].parent;

                            if(root2 != root) {
                                if(node[root].rank > node[root2].rank)
                                    node[root2].parent = root;
                                else {
                                    node[root].parent = root2;
                                    if (node[root].rank == node[root2].rank)
                                    node[root2].rank++;
                                    root = root2;
                                }

                                /* compress path from node2 to the root: */
                                var temp, node2 = j;
                                while (node[node2].parent != -1) {
                                    temp = node2;
                                    node2 = node[node2].parent;
                                    node[temp].parent = root;
                                }

                                /* compress path from node to the root: */
                                node2 = i;
                                while (node[node2].parent != -1) {
                                    temp = node2;
                                    node2 = node[node2].parent;
                                    node[temp].parent = root;
                                }
                            }
                        }
                    }
                }
                var idx_seq = [];
                var class_idx = 0;
                for(i = 0; i < n; i++) {
                    j = -1;
                    var node1 = i;
                    if(node[node1].element) {
                        while (node[node1].parent != -1)
                            node1 = node[node1].parent;
                        if(node[node1].rank >= 0)
                            node[node1].rank = ~class_idx++;
                        j = ~node[node1].rank;
                    }
                    idx_seq[i] = j;
                }
                
                var comps = [];
                for (i = 0; i < class_idx+1; ++i) {
                    comps[i] = {"neighbors" : 0,
                                "x" : 0,
                                "y" : 0,
                                "width" : 0,
                                "height" : 0,
                                "confidence" : 0};
                }

                // count number of neighbors
                for(i = 0; i < n; ++i) {
                    var r1 = rects[i];
                    var idx = idx_seq[i];

                    if (comps[idx].neighbors == 0)
                        comps[idx].confidence = r1.confidence;

                    ++comps[idx].neighbors;

                    comps[idx].x += r1.x;
                    comps[idx].y += r1.y;
                    comps[idx].width += r1.width;
                    comps[idx].height += r1.height;
                    comps[idx].confidence = Math.max(comps[idx].confidence, r1.confidence);
                }

                var seq2 = [];
                // calculate average bounding box
                for(i = 0; i < class_idx; ++i) {
                    n = comps[i].neighbors;
                    if (n >= min_neighbors)
                        seq2.push({"x" : (comps[i].x * 2 + n) / (2 * n),
                                   "y" : (comps[i].y * 2 + n) / (2 * n),
                                   "width" : (comps[i].width * 2 + n) / (2 * n),
                                   "height" : (comps[i].height * 2 + n) / (2 * n),
                                   "neighbors" : comps[i].neighbors,
                                   "confidence" : comps[i].confidence});
                }

                var result_seq = [];
                n = seq2.length;
                // filter out small face rectangles inside large face rectangles
                for(i = 0; i < n; ++i) {
                    var r1 = seq2[i];
                    var flag = true;
                    for(j = 0; j < n; ++j) {
                        var r2 = seq2[j];
                        var distance = (r2.width * 0.25 + 0.5)|0;

                        if(i != j &&
                           r1.x >= r2.x - distance &&
                           r1.y >= r2.y - distance &&
                           r1.x + r1.width <= r2.x + r2.width + distance &&
                           r1.y + r1.height <= r2.y + r2.height + distance &&
                           (r2.neighbors > Math.max(3, r1.neighbors) || r1.neighbors < 3)) {
                            flag = false;
                            break;
                        }
                    }

                    if(flag)
                        result_seq.push(r1);
                }
                return result_seq;
            }

        };

    })();

    global.bbf = bbf;

})(jsfeat);
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

(function(lib) {
    "use strict";

    if (typeof module === "undefined" || typeof module.exports === "undefined") {
        // in a browser, define its namespaces in global
        window.jsfeat = lib;
    } else {
        // in commonjs, or when AMD wrapping has been applied, define its namespaces as exports
        module.exports = lib;
    }
})(jsfeat);

},{}]},{},[1]);
