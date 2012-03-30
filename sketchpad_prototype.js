/* 
 * Raphael SketchPad_pro
 * Coypright (c) 2012 by
 * Peng Zhang
 * 
 * Requires:
 * Prototype: http://prototypejs.org/
 * Raphael: http://raphaeljs.com
 * 
 * Reference:
 * http://ianli.com/sketchpad/
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 * 
 */

(function(Raphael) {
	/**
	 * Function to create SketchPad object.
	 */
	Raphael.sketchpad = function(paper, options) {
		return new SketchPad(paper, options);
	};

	/**
	 * The SketchPad object.
	 */
	var SketchPad = function(paper, options) {
		var self = this;

		var _options = {
			width : 100,
			height : 100,
			strokes : [],
			editing : true
		};
		Object.extend(_options, options);

		var _paper;
		if (paper.raphael && paper.raphael.constructor == Raphael.constructor) {
			_paper = paper;
		} else if (typeof paper == "string") {			
			_paper = Raphael(paper, _options.width, _options.height);
		} else {
			throw "first argument must be a Raphael object, an element ID, an array with 3 elements";
		}
			
		var _canvas = _paper.canvas;
		
		var _container = $(paper);

		var _pen = new Pen();

		self.paper = function() {
			return _paper;
		};

		self.canvas = function() {
			return _canvas;
		};

		self.container = function() {
			return _container;
		};

		self.pen = function(value) {
			if (value === undefined) {
				return _pen;
			}
			_pen = value;
			return self; 
		};

		function svg_path_to_string(path) {
			var str = "";
			for ( var i = 0, n = path.length; i < n; i++) {
				var point = path[i];
				str += point[0] + point[1] + "," + point[2];
			}
			return str;
		}
		
		function string_to_svg_path(str) {
			var path = [];
			var tokens = str.split("L");

			if (tokens.length > 0) {
				var token = tokens[0].replace("M", "");
				var points = token.split(",");
				path.push([ "M", parseInt(points[0]), parseInt(points[1]) ]);

				for ( var i = 1, n = tokens.length; i < n; i++) {
					token = tokens[i];
					points = token.split(",");
					path
							.push([ "L", parseInt(points[0]),
									parseInt(points[1]) ]);
				}
			}

			return path;
		}

		self.json = function(value) {
			if (value === undefined) {
				for ( var i = 0, n = _strokes.length; i < n; i++) {
					var stroke = _strokes[i];
					if (typeof stroke.path == "object") {
						stroke.path = svg_path_to_string(stroke.path);
					}
				}
				return Object.toJSON(_strokes);
			}
			return self.strokes(value.evalJSON(true));
		};

		self.strokes = function(value) {
			if (value === undefined) {
				return _strokes;
			}
			if (Object.isArray(value)) {
				_strokes = value;

				for ( var i = 0, n = _strokes.length; i < n; i++) {
					var stroke = _strokes[i];
					if (typeof stroke.path == "string") {
						stroke.path = string_to_svg_path(stroke.path);
					}
				}

				_action_history.add({
					type : "batch",
					strokes : _strokes.clone()
				});

				_redraw_strokes();
				_fire_change();
			}
			return self; 
		};

		self.freeze_history = function() {
			_action_history.freeze();
		};

		self.undoable = function() {
			return _action_history.undoable();
		};

		self.undo = function() {
			if (_action_history.undoable()) {
				_action_history.undo();
				_strokes = _action_history.current_strokes();
				_redraw_strokes();
				_fire_change();
			}
			return self; 
		};

		self.redoable = function() {
			return _action_history.redoable();
		};

		self.redo = function() {
			if (_action_history.redoable()) {
				_action_history.redo();
				_strokes = _action_history.current_strokes();
				_redraw_strokes();
				_fire_change();
			}
			return self;
		};

		self.clear = function() {
			_action_history.add({
				type : "clear"
			});

			_strokes = [];
			_redraw_strokes();
			_fire_change();

			return self;
		};

		self.animate = function(ms) {
			if (ms === undefined) {
				ms = 500;
			}

			_paper.clear();

			if (_strokes.length > 0) {
				var i = 0;

				function animate() {
					var stroke = _strokes[i];
					var type = stroke.type;
					_paper[type]().attr(stroke).click(_pathclick);

					i++;
					if (i < _strokes.length) {
						setTimeout(animate, ms);
					}
				}
				;

				animate();
			}

			return self; 
		};

		self.editing = function(mode) {
			if (mode === undefined) {
				return _options.editing;
			}

			_options.editing = mode;
			if (_options.editing) {
				if (_options.editing == "erase") {
					$(_container).setStyle({
						cursor : 'crosshair'
					});
					Event.stopObserving($(_container), 'mousedown', _mousedown);
					Event.stopObserving($(_container), 'mousemove', _mousemove);
					Event.stopObserving($(_container), 'mouseup', _mouseup);
					Event.stopObserving($(document), 'mouseup', _mouseup);

					
					var agent = navigator.userAgent;
					if (agent.indexOf("iPhone") > 0
							|| agent.indexOf("iPod") > 0
							|| agent.indexOf("iPad") > 0) {
						Event.stopObserving($(_container), 'touchstart',
								_touchstart);
						Event.stopObserving($(_container), 'touchmove',
								_touchmove);
						Event.stopObserving($(_container), 'touchend',
								_touchend);
					}
				} else {
					$(_container).setStyle({
						cursor : 'crosshair'
					});
					Event.observe($(_container), 'mousedown', _mousedown);
					Event.observe($(_container), 'mousemove', _mousemove);
					Event.observe($(_container), 'mouseup', _mouseup);

					Event.observe($(document), 'mouseup', _mouseup);

					var agent = navigator.userAgent;
					if (agent.indexOf("iPhone") > 0
							|| agent.indexOf("iPod") > 0
							|| agent.indexOf("iPad") > 0) {
						Event.observe($(_container), 'touchstart', _touchstart);
						Event.observe($(_container), 'touchmove', _touchmove);
						Event.observe($(_container), 'touchend', _touchend);
					}
				}
			} else {
				$(_container).setStyle({
					cursor : 'default'
				});
				Event.stopObserving($(_container), 'mousedown', _mousedown);
				Event.stopObserving($(_container), 'mousemove', _mousemove);
				Event.stopObserving($(_container), 'mouseup', _mouseup);
				Event.stopObserving($(document), 'mouseup', _mouseup);

				var agent = navigator.userAgent;
				if (agent.indexOf("iPhone") > 0 || agent.indexOf("iPod") > 0
						|| agent.indexOf("iPad") > 0) {
					Event.stopObserving($(_container), 'touchstart',
							_touchstart);
					Event.stopObserving($(_container), 'touchmove', _touchmove);
					Event.stopObserving($(_container), 'touchend', _touchend);
				}
			}

			return self; 
		};

		var _change_fn = function() {
		};
		self.change = function(fn) {
			if (fn == null || fn === undefined) {
				_change_fn = function() {
				};
			} else if (typeof fn == "function") {
				_change_fn = fn;
			}
		};

		function _fire_change() {
			_change_fn();
		};

		function _redraw_strokes() {
			_paper.clear();

			for ( var i = 0, n = _strokes.length; i < n; i++) {
				var stroke = _strokes[i];
				var type = stroke.type;
				_paper[type]().attr(stroke).click(_pathclick);
			}
		}
		;

		function _disable_user_select() {
			$$('div').each(function(d) {
				d.setStyle({
					"-webkit-user-select" : "none"
				});
				d.setStyle({
					"-moz-user-select" : "none"
				});
				d.setStyle({
					"user-select" : "none"
				});
			});
		}

		function _enable_user_select() {
			
			$$('div').each(function(d) {
				d.setStyle({
					"-webkit-user-select" : "text"
				});
				d.setStyle({
					"-moz-user-select" : "text"
				});
				d.setStyle({
					"user-select" : "text"
				});
			});
		}

		function _pathclick(e) {
			if (_options.editing == "erase") {
				var stroke = this.attr();
				stroke.type = this.type;

				_action_history.add({
					type : "erase",
					stroke : stroke
				});

				for ( var i = 0, n = _strokes.length; i < n; i++) {
					var s = _strokes[i];
					if (equiv(s, stroke)) {
						_strokes.splice(i, 1);
					}
				}

				_fire_change();

				this.remove();
			}
		};

		function _mousedown(e) {
			_disable_user_select();

			_pen.start(e, self);
		};

		function _mousemove(e) {
			_pen.move(e, self);
		};

		function _mouseup(e) {
			_enable_user_select();

			var path = _pen.finish(e, self);

			if (path != null) {
				path.click(_pathclick);

				var stroke = path.attr();
				stroke.type = path.type;
				_strokes.push(stroke);
				_action_history.add({
					type : "stroke",
					stroke : stroke
				});

				_fire_change();
			}
		}
		;

		function _touchstart(e) {
			Event.stop(e);

			if (e.touches.length == 1) {
				var touch = e.touches[0];
				_mousedown(touch);
			}
		}

		function _touchmove(e) {
			Event.stop(e);
			if (e.touches.length == 1) {
				var touch = e.touches[0];
				_mousemove(touch);
			}
		}

		function _touchend(e) {
			Event.stop(e);
			_mouseup(e);
		}

		var _action_history = new ActionHistory();
		
		var _strokes = _options.strokes;
		
		if (Object.isArray(_strokes) && _strokes.length > 0) {
			_action_history.add({
				type : "init",
				strokes : _strokes.clone()			
			});
			_redraw_strokes();
		} else {
			_strokes = [];
			_redraw_strokes();
		}

		self.editing(_options.editing);
	};

	var ActionHistory = function() {
		var self = this;

		var _history = [];

		var _current_state = -1;
		var _freeze_state = -1;
		var _current_strokes = null;

		self.add = function(action) {
			if (_current_state + 1 < _history.length) {
				_history.splice(_current_state + 1, _history.length
						- (_current_state + 1));
			}

			_history.push(action);
			_current_state = _history.length - 1;
			_current_strokes = null;
		};

		self.freeze = function(index) {
			if (index === undefined) {
				_freeze_state = _current_state;
			} else {
				_freeze_state = index;
			}
		};

		self.undoable = function() {
			return (_current_state > -1 && _current_state > _freeze_state);
		};

		self.undo = function() {
			if (self.undoable()) {
				_current_state--;
				_current_strokes = null;
			}
		};

		self.redoable = function() {
			return _current_state < _history.length - 1;
		};

		self.redo = function() {
			if (self.redoable()) {
				_current_state++;				
				_current_strokes = null;
			}
		};
		
		self.current_strokes = function() {
			if (_current_strokes == null) {
				var strokes = [];
				for ( var i = 0; i <= _current_state; i++) {
					var action = _history[i];
					switch (action.type) {
					case "init":
					case "json":
					case "strokes":
					case "batch":
						strokes = strokes.concat(action.strokes);
						break;
					case "stroke":
						strokes.push(action.stroke);
						break;
					case "erase":
						for ( var s = 0, n = strokes.length; s < n; s++) {
							var stroke = strokes[s];
							if (equiv(stroke, action.stroke)) {
								strokes.splice(s, 1);
							}
						}
						break;
					case "clear":
						strokes = [];
						break;
					}
				}

				_current_strokes = strokes;
			}
			return _current_strokes;
		};
	};

	/**
	 * The default Pen object.
	 */
	var Pen = function() {
		var self = this;

		var _color = "#000000";
		var _opacity = 1.0;
		var _width = 5;
		var _offset = null;

		var _drawing = false;
		var _c = null;
		var _points = [];

		self.color = function(value) {
			if (value === undefined) {
				return _color;
			}

			_color = value;

			return self;
		};

		self.width = function(value) {
			if (value === undefined) {
				return _width;
			}

			if (value < Pen.MIN_WIDTH) {
				value = Pen.MIN_WIDTH;
			} else if (value > Pen.MAX_WIDTH) {
				value = Pen.MAX_WIDTH;
			}

			_width = value;

			return self;
		};

		self.opacity = function(value) {
			if (value === undefined) {
				return _opacity;
			}

			if (value < 0) {
				value = 0;
			} else if (value > 1) {
				value = 1;
			}

			_opacity = value;

			return self;
		};

		self.start = function(e, sketchpad) {
			_drawing = true;
			
			_offset = Position.cumulativeOffset(sketchpad.container());
			
			var x = Event.pointerX(e) - _offset[0], y = Event.pointerY(e) - _offset[1];
			_points.push([ x, y ]);

			_c = sketchpad.paper().path();

			_c.attr({
				stroke : _color,
				"stroke-opacity" : _opacity,
				"stroke-width" : _width,
				"stroke-linecap" : "round",
				"stroke-linejoin" : "round"
			});
		};

		self.finish = function(e, sketchpad) {
			var path = null;

			if (_c != null) {
				if (_points.length <= 1) {
					_c.remove();
				} else {
					path = _c;
				}
			}

			_drawing = false;
			_c = null;
			_points = [];

			return path;
		};

		self.move = function(e, sketchpad) {
			if (_drawing == true) {
				_offset = Position.cumulativeOffset(sketchpad.container());
				var x = Event.pointerX(e) - _offset[0], y = Event.pointerY(e) - _offset[1];
				_points.push([ x, y ]);
				_c.attr({
					path : points_to_svg()
				});
			}
		};

		function points_to_svg() {
			if (_points != null && _points.length > 1) {
				var p = _points[0];
				var path = "M" + p[0] + "," + p[1];
				for ( var i = 1, n = _points.length; i < n; i++) {
					p = _points[i];
					path += "L" + p[0] + "," + p[1];
				}
				return path;
			} else {
				return "";
			}
		}
		;
	};

	Pen.MAX_WIDTH = 1000;
	Pen.MIN_WIDTH = 1;

	/**
	 * Utility to generate string representation of an object.
	 */
	function inspect(obj) {
		var str = "";
		for ( var i in obj) {
			str += i + "=" + obj[i] + "\n";
		}
		return str;
	}

})(window.Raphael);

Raphael.fn.display = function(elements) {
	for ( var i = 0, n = elements.length; i < n; i++) {
		var e = elements[i];
		var type = e.type;
		this[type]().attr(e);
	}
};

/**
 * Utility functions to compare objects by Phil Rathe.
 * http://philrathe.com/projects/equiv
 */

// Determine what is o.
function hoozit(o) {
	if (o.constructor === String) {
		return "string";

	} else if (o.constructor === Boolean) {
		return "boolean";

	} else if (o.constructor === Number) {

		if (isNaN(o)) {
			return "nan";
		} else {
			return "number";
		}

	} else if (typeof o === "undefined") {
		return "undefined";

		// consider: typeof null === object
	} else if (o === null) {
		return "null";

		// consider: typeof [] === object
	} else if (o instanceof Array) {
		return "array";

		// consider: typeof new Date() === object
	} else if (o instanceof Date) {
		return "date";

		// consider: /./ instanceof Object;
		// /./ instanceof RegExp;
		// typeof /./ === "function"; // => false in IE and
		// Opera,
		// true in FF and Safari
	} else if (o instanceof RegExp) {
		return "regexp";

	} else if (typeof o === "object") {
		return "object";

	} else if (o instanceof Function) {
		return "function";
	} else {
		return undefined;
	}
}

// Call the o related callback with the given arguments.
function bindCallbacks(o, callbacks, args) {
	var prop = hoozit(o);
	if (prop) {
		if (hoozit(callbacks[prop]) === "function") {
			return callbacks[prop].apply(callbacks, args);
		} else {
			return callbacks[prop]; // or undefined
		}
	}
}

// Test for equality any JavaScript type.
// Discussions and reference: http://philrathe.com/articles/equiv
// Test suites: http://philrathe.com/tests/equiv
// Author: Philippe RathÃƒÂ© <prathe@gmail.com>

var equiv = function() {

	var innerEquiv; // the real equiv function
	var callers = []; // stack to decide between skip/abort functions

	var callbacks = function() {

		// for string, boolean, number and null
		function useStrictEquality(b, a) {
			if (b instanceof a.constructor || a instanceof b.constructor) {
				// to catch short annotaion VS
				// 'new' annotation of a
				// declaration
				// e.g. var i = 1;
				// var j = new Number(1);
				return a == b;
} else {
return a === b;
}
}

return {
			"string" : useStrictEquality,
			"boolean" : useStrictEquality,
			"number" : useStrictEquality,
			"null" : useStrictEquality,
			"undefined" : useStrictEquality,

			"nan" : function(b) {
				return isNaN(b);
			},

			"date" : function(b, a) {
				return hoozit(b) === "date" && a.valueOf() === b.valueOf();
			},

			"regexp" : function(b, a) {
				return hoozit(b) === "regexp" && a.source === b.source && // the
				// regex
				// itself
				a.global === b.global && // and
				// its
				// modifers
				// (gmi)
				// ...
				a.ignoreCase === b.ignoreCase && a.multiline === b.multiline;
			},

			// - skip when the property is a method of
			// an instance (OOP)
			// - abort otherwise,
			// initial === would have catch identical
			// references anyway
			"function" : function() {
				var caller = callers[callers.length - 1];
				return caller !== Object && typeof caller !== "undefined";
			},

			"array" : function(b, a) {
				var i;
				var len;

				// b could be an object literal
				// here
				if (!(hoozit(b) === "array")) {
					return false;
				}

				len = a.length;
				if (len !== b.length) { // safe
				// and
				// faster
					return false;
				}
				for (i = 0; i < len; i++) {
					if (!innerEquiv(a[i], b[i])) {
						return false;
					}
				}
				return true;
			},

			"object" : function(b, a) {
				var i;
				var eq = true; // unless we can
				// proove it
				var aProperties = [], bProperties = []; // collection
				// of
				// strings

				// comparing constructors is
				// more strict than using
				// instanceof
				if (a.constructor !== b.constructor) {
					return false;
				}

				// stack constructor before
				// traversing properties
				callers.push(a.constructor);

				for (i in a) { // be strict:
				// don't ensures
				// hasOwnProperty
				// and
				// go
				// deep

					aProperties.push(i); // collect
					// a's
					// properties

					if (!innerEquiv(a[i], b[i])) {
						eq = false;
					}
				}

				callers.pop(); // unstack, we
				// are done

				for (i in b) {
					bProperties.push(i); // collect
					// b's
					// properties
				}

				// Ensures identical properties
				// name
				return eq && innerEquiv(aProperties.sort(), bProperties.sort());
			}
		};
	}();

	innerEquiv = function() { // can take multiple arguments
		var args = Array.prototype.slice.apply(arguments);
		if (args.length < 2) {
			return true; // end transition
		}

		return (function(a, b) {
			if (a === b) {
				return true; // catch the
				// most you can
			} else if (a === null || b === null || typeof a === "undefined"
					|| typeof b === "undefined" || hoozit(a) !== hoozit(b)) {
				return false; // don't lose
				// time with
				// error prone
				// cases
			} else {
				return bindCallbacks(a, callbacks, [ b, a ]);
			}

			// apply transition with (1..n) arguments
		})(args[0], args[1])
				&& arguments.callee
						.apply(this, args.splice(1, args.length - 1));
	};

	return innerEquiv;

}();
