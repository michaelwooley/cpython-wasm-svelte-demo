var createPythonModule = (() => {
	var _scriptDir = import.meta.url;

	return function (createPythonModule) {
		createPythonModule = createPythonModule || {};

		var Module = typeof createPythonModule != 'undefined' ? createPythonModule : {};
		var readyPromiseResolve, readyPromiseReject;
		Module['ready'] = new Promise(function (resolve, reject) {
			readyPromiseResolve = resolve;
			readyPromiseReject = reject;
		});
		if (!Module.expectedDataFileDownloads) {
			Module.expectedDataFileDownloads = 0;
		}
		Module.expectedDataFileDownloads++;
		(function () {
			if (Module['ENVIRONMENT_IS_PTHREAD']) return;
			var loadPackage = function (metadata) {
				var PACKAGE_PATH = '';
				if (typeof window === 'object') {
					PACKAGE_PATH = window['encodeURIComponent'](
						window.location.pathname
							.toString()
							.substring(0, window.location.pathname.toString().lastIndexOf('/')) + '/'
					);
				} else if (typeof process === 'undefined' && typeof location !== 'undefined') {
					PACKAGE_PATH = encodeURIComponent(
						location.pathname
							.toString()
							.substring(0, location.pathname.toString().lastIndexOf('/')) + '/'
					);
				}
				var PACKAGE_NAME = 'python.data';
				var REMOTE_PACKAGE_BASE = 'python.data';
				if (typeof Module['locateFilePackage'] === 'function' && !Module['locateFile']) {
					Module['locateFile'] = Module['locateFilePackage'];
					err(
						'warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)'
					);
				}
				var REMOTE_PACKAGE_NAME = Module['locateFile']
					? Module['locateFile'](REMOTE_PACKAGE_BASE, '')
					: REMOTE_PACKAGE_BASE;
				var REMOTE_PACKAGE_SIZE = metadata['remote_package_size'];
				var PACKAGE_UUID = metadata['package_uuid'];
				function fetchRemotePackage(packageName, packageSize, callback, errback) {
					var xhr = new XMLHttpRequest();
					xhr.open('GET', packageName, true);
					xhr.responseType = 'arraybuffer';
					xhr.onprogress = function (event) {
						var url = packageName;
						var size = packageSize;
						if (event.total) size = event.total;
						if (event.loaded) {
							if (!xhr.addedTotal) {
								xhr.addedTotal = true;
								if (!Module.dataFileDownloads) Module.dataFileDownloads = {};
								Module.dataFileDownloads[url] = { loaded: event.loaded, total: size };
							} else {
								Module.dataFileDownloads[url].loaded = event.loaded;
							}
							var total = 0;
							var loaded = 0;
							var num = 0;
							for (var download in Module.dataFileDownloads) {
								var data = Module.dataFileDownloads[download];
								total += data.total;
								loaded += data.loaded;
								num++;
							}
							total = Math.ceil((total * Module.expectedDataFileDownloads) / num);
							if (Module['setStatus'])
								Module['setStatus']('Downloading data... (' + loaded + '/' + total + ')');
						} else if (!Module.dataFileDownloads) {
							if (Module['setStatus']) Module['setStatus']('Downloading data...');
						}
					};
					xhr.onerror = function (event) {
						throw new Error('NetworkError for: ' + packageName);
					};
					xhr.onload = function (event) {
						if (
							xhr.status == 200 ||
							xhr.status == 304 ||
							xhr.status == 206 ||
							(xhr.status == 0 && xhr.response)
						) {
							var packageData = xhr.response;
							callback(packageData);
						} else {
							throw new Error(xhr.statusText + ' : ' + xhr.responseURL);
						}
					};
					xhr.send(null);
				}
				function handleError(error) {
					console.error('package error:', error);
				}
				var fetchedCallback = null;
				var fetched = Module['getPreloadedPackage']
					? Module['getPreloadedPackage'](REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE)
					: null;
				if (!fetched)
					fetchRemotePackage(
						REMOTE_PACKAGE_NAME,
						REMOTE_PACKAGE_SIZE,
						function (data) {
							if (fetchedCallback) {
								fetchedCallback(data);
								fetchedCallback = null;
							} else {
								fetched = data;
							}
						},
						handleError
					);
				function runWithFS() {
					function assert(check, msg) {
						if (!check) throw msg + new Error().stack;
					}
					Module['FS_createPath']('/', 'usr', true, true);
					Module['FS_createPath']('/usr', 'local', true, true);
					Module['FS_createPath']('/usr/local', 'lib', true, true);
					Module['FS_createPath']('/usr/local/lib', 'python3.11', true, true);
					Module['FS_createPath']('/usr/local/lib/python3.11', 'lib-dynload', true, true);
					function DataRequest(start, end, audio) {
						this.start = start;
						this.end = end;
						this.audio = audio;
					}
					DataRequest.prototype = {
						requests: {},
						open: function (mode, name) {
							this.name = name;
							this.requests[name] = this;
							Module['addRunDependency']('fp ' + this.name);
						},
						send: function () {},
						onload: function () {
							var byteArray = this.byteArray.subarray(this.start, this.end);
							this.finish(byteArray);
						},
						finish: function (byteArray) {
							var that = this;
							Module['FS_createDataFile'](this.name, null, byteArray, true, true, true);
							Module['removeRunDependency']('fp ' + that.name);
							this.requests[this.name] = null;
						}
					};
					var files = metadata['files'];
					for (var i = 0; i < files.length; ++i) {
						new DataRequest(files[i]['start'], files[i]['end'], files[i]['audio'] || 0).open(
							'GET',
							files[i]['filename']
						);
					}
					function processPackageData(arrayBuffer) {
						assert(arrayBuffer, 'Loading data file failed.');
						assert(arrayBuffer instanceof ArrayBuffer, 'bad input to processPackageData');
						var byteArray = new Uint8Array(arrayBuffer);
						DataRequest.prototype.byteArray = byteArray;
						var files = metadata['files'];
						for (var i = 0; i < files.length; ++i) {
							DataRequest.prototype.requests[files[i].filename].onload();
						}
						Module['removeRunDependency']('datafile_python.data');
					}
					Module['addRunDependency']('datafile_python.data');
					if (!Module.preloadResults) Module.preloadResults = {};
					Module.preloadResults[PACKAGE_NAME] = { fromCache: false };
					if (fetched) {
						processPackageData(fetched);
						fetched = null;
					} else {
						fetchedCallback = processPackageData;
					}
				}
				if (Module['calledRun']) {
					runWithFS();
				} else {
					if (!Module['preRun']) Module['preRun'] = [];
					Module['preRun'].push(runWithFS);
				}
			};
			loadPackage({
				files: [
					{ filename: '/usr/local/lib/python311.zip', start: 0, end: 3196262 },
					{ filename: '/usr/local/lib/python3.11/os.py', start: 3196262, end: 3235727 },
					{ filename: '/usr/local/lib/python3.11/lib-dynload/.empty', start: 3235727, end: 3235727 }
				],
				remote_package_size: 3235727,
				package_uuid: '741566d5-ae2a-4cb1-9bb3-2c337c5cd11b'
			});
		})();
		var moduleOverrides = Object.assign({}, Module);
		var arguments_ = [];
		var thisProgram = './this.program';
		var quit_ = (status, toThrow) => {
			throw toThrow;
		};
		var ENVIRONMENT_IS_WEB = typeof window == 'object';
		var ENVIRONMENT_IS_WORKER = typeof importScripts == 'function';
		var ENVIRONMENT_IS_NODE =
			typeof process == 'object' &&
			typeof process.versions == 'object' &&
			typeof process.versions.node == 'string';
		var scriptDirectory = '';
		function locateFile(path) {
			if (Module['locateFile']) {
				return Module['locateFile'](path, scriptDirectory);
			}
			return scriptDirectory + path;
		}
		var read_, readAsync, readBinary, setWindowTitle;
		if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
			if (ENVIRONMENT_IS_WORKER) {
				scriptDirectory = self.location.href;
			} else if (typeof document != 'undefined' && document.currentScript) {
				scriptDirectory = document.currentScript.src;
			}
			if (_scriptDir) {
				scriptDirectory = _scriptDir;
			}
			if (scriptDirectory.indexOf('blob:') !== 0) {
				scriptDirectory = scriptDirectory.substr(
					0,
					scriptDirectory.replace(/[?#].*/, '').lastIndexOf('/') + 1
				);
			} else {
				scriptDirectory = '';
			}
			{
				read_ = (url) => {
					var xhr = new XMLHttpRequest();
					xhr.open('GET', url, false);
					xhr.send(null);
					return xhr.responseText;
				};
				if (ENVIRONMENT_IS_WORKER) {
					readBinary = (url) => {
						var xhr = new XMLHttpRequest();
						xhr.open('GET', url, false);
						xhr.responseType = 'arraybuffer';
						xhr.send(null);
						return new Uint8Array(xhr.response);
					};
				}
				readAsync = (url, onload, onerror) => {
					var xhr = new XMLHttpRequest();
					xhr.open('GET', url, true);
					xhr.responseType = 'arraybuffer';
					xhr.onload = () => {
						if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
							onload(xhr.response);
							return;
						}
						onerror();
					};
					xhr.onerror = onerror;
					xhr.send(null);
				};
			}
			setWindowTitle = (title) => (document.title = title);
		} else {
		}
		var out = Module['print'] || console.log.bind(console);
		var err = Module['printErr'] || console.warn.bind(console);
		Object.assign(Module, moduleOverrides);
		moduleOverrides = null;
		if (Module['arguments']) arguments_ = Module['arguments'];
		if (Module['thisProgram']) thisProgram = Module['thisProgram'];
		if (Module['quit']) quit_ = Module['quit'];
		var wasmBinary;
		if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
		var noExitRuntime = Module['noExitRuntime'] || true;
		if (typeof WebAssembly != 'object') {
			abort('no native wasm support detected');
		}
		var wasmMemory;
		var ABORT = false;
		var EXITSTATUS;
		function assert(condition, text) {
			if (!condition) {
				abort(text);
			}
		}
		var UTF8Decoder = typeof TextDecoder != 'undefined' ? new TextDecoder('utf8') : undefined;
		function UTF8ArrayToString(heapOrArray, idx, maxBytesToRead) {
			var endIdx = idx + maxBytesToRead;
			var endPtr = idx;
			while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
			if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
				return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
			} else {
				var str = '';
				while (idx < endPtr) {
					var u0 = heapOrArray[idx++];
					if (!(u0 & 128)) {
						str += String.fromCharCode(u0);
						continue;
					}
					var u1 = heapOrArray[idx++] & 63;
					if ((u0 & 224) == 192) {
						str += String.fromCharCode(((u0 & 31) << 6) | u1);
						continue;
					}
					var u2 = heapOrArray[idx++] & 63;
					if ((u0 & 240) == 224) {
						u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
					} else {
						u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
					}
					if (u0 < 65536) {
						str += String.fromCharCode(u0);
					} else {
						var ch = u0 - 65536;
						str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
					}
				}
			}
			return str;
		}
		function UTF8ToString(ptr, maxBytesToRead) {
			return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
		}
		function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
			if (!(maxBytesToWrite > 0)) return 0;
			var startIdx = outIdx;
			var endIdx = outIdx + maxBytesToWrite - 1;
			for (var i = 0; i < str.length; ++i) {
				var u = str.charCodeAt(i);
				if (u >= 55296 && u <= 57343) {
					var u1 = str.charCodeAt(++i);
					u = (65536 + ((u & 1023) << 10)) | (u1 & 1023);
				}
				if (u <= 127) {
					if (outIdx >= endIdx) break;
					heap[outIdx++] = u;
				} else if (u <= 2047) {
					if (outIdx + 1 >= endIdx) break;
					heap[outIdx++] = 192 | (u >> 6);
					heap[outIdx++] = 128 | (u & 63);
				} else if (u <= 65535) {
					if (outIdx + 2 >= endIdx) break;
					heap[outIdx++] = 224 | (u >> 12);
					heap[outIdx++] = 128 | ((u >> 6) & 63);
					heap[outIdx++] = 128 | (u & 63);
				} else {
					if (outIdx + 3 >= endIdx) break;
					heap[outIdx++] = 240 | (u >> 18);
					heap[outIdx++] = 128 | ((u >> 12) & 63);
					heap[outIdx++] = 128 | ((u >> 6) & 63);
					heap[outIdx++] = 128 | (u & 63);
				}
			}
			heap[outIdx] = 0;
			return outIdx - startIdx;
		}
		function stringToUTF8(str, outPtr, maxBytesToWrite) {
			return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
		}
		function lengthBytesUTF8(str) {
			var len = 0;
			for (var i = 0; i < str.length; ++i) {
				var u = str.charCodeAt(i);
				if (u >= 55296 && u <= 57343)
					u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
				if (u <= 127) ++len;
				else if (u <= 2047) len += 2;
				else if (u <= 65535) len += 3;
				else len += 4;
			}
			return len;
		}
		function allocateUTF8(str) {
			var size = lengthBytesUTF8(str) + 1;
			var ret = _malloc(size);
			if (ret) stringToUTF8Array(str, HEAP8, ret, size);
			return ret;
		}
		function allocateUTF8OnStack(str) {
			var size = lengthBytesUTF8(str) + 1;
			var ret = stackAlloc(size);
			stringToUTF8Array(str, HEAP8, ret, size);
			return ret;
		}
		function writeArrayToMemory(array, buffer) {
			HEAP8.set(array, buffer);
		}
		function writeAsciiToMemory(str, buffer, dontAddNull) {
			for (var i = 0; i < str.length; ++i) {
				HEAP8[buffer++ >> 0] = str.charCodeAt(i);
			}
			if (!dontAddNull) HEAP8[buffer >> 0] = 0;
		}
		var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
		function updateGlobalBufferAndViews(buf) {
			buffer = buf;
			Module['HEAP8'] = HEAP8 = new Int8Array(buf);
			Module['HEAP16'] = HEAP16 = new Int16Array(buf);
			Module['HEAP32'] = HEAP32 = new Int32Array(buf);
			Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
			Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
			Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
			Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
			Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
		}
		var INITIAL_MEMORY = Module['INITIAL_MEMORY'] || 20971520;
		var wasmTable;
		var __ATPRERUN__ = [];
		var __ATINIT__ = [];
		var __ATMAIN__ = [];
		var __ATPOSTRUN__ = [];
		var runtimeInitialized = false;
		function keepRuntimeAlive() {
			return noExitRuntime;
		}
		function preRun() {
			if (Module['preRun']) {
				if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
				while (Module['preRun'].length) {
					addOnPreRun(Module['preRun'].shift());
				}
			}
			callRuntimeCallbacks(__ATPRERUN__);
		}
		function initRuntime() {
			runtimeInitialized = true;
			if (!Module['noFSInit'] && !FS.init.initialized) FS.init();
			FS.ignorePermissions = false;
			TTY.init();
			SOCKFS.root = FS.mount(SOCKFS, {}, null);
			PIPEFS.root = FS.mount(PIPEFS, {}, null);
			callRuntimeCallbacks(__ATINIT__);
		}
		function preMain() {
			callRuntimeCallbacks(__ATMAIN__);
		}
		function postRun() {
			if (Module['postRun']) {
				if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
				while (Module['postRun'].length) {
					addOnPostRun(Module['postRun'].shift());
				}
			}
			callRuntimeCallbacks(__ATPOSTRUN__);
		}
		function addOnPreRun(cb) {
			__ATPRERUN__.unshift(cb);
		}
		function addOnInit(cb) {
			__ATINIT__.unshift(cb);
		}
		function addOnPostRun(cb) {
			__ATPOSTRUN__.unshift(cb);
		}
		var runDependencies = 0;
		var runDependencyWatcher = null;
		var dependenciesFulfilled = null;
		function getUniqueRunDependency(id) {
			return id;
		}
		function addRunDependency(id) {
			runDependencies++;
			if (Module['monitorRunDependencies']) {
				Module['monitorRunDependencies'](runDependencies);
			}
		}
		function removeRunDependency(id) {
			runDependencies--;
			if (Module['monitorRunDependencies']) {
				Module['monitorRunDependencies'](runDependencies);
			}
			if (runDependencies == 0) {
				if (runDependencyWatcher !== null) {
					clearInterval(runDependencyWatcher);
					runDependencyWatcher = null;
				}
				if (dependenciesFulfilled) {
					var callback = dependenciesFulfilled;
					dependenciesFulfilled = null;
					callback();
				}
			}
		}
		function abort(what) {
			{
				if (Module['onAbort']) {
					Module['onAbort'](what);
				}
			}
			what = 'Aborted(' + what + ')';
			err(what);
			ABORT = true;
			EXITSTATUS = 1;
			what += '. Build with -sASSERTIONS for more info.';
			var e = new WebAssembly.RuntimeError(what);
			readyPromiseReject(e);
			throw e;
		}
		var dataURIPrefix = 'data:application/octet-stream;base64,';
		function isDataURI(filename) {
			return filename.startsWith(dataURIPrefix);
		}
		var wasmBinaryFile;
		if (Module['locateFile']) {
			wasmBinaryFile = 'python.wasm';
			if (!isDataURI(wasmBinaryFile)) {
				wasmBinaryFile = locateFile(wasmBinaryFile);
			}
		} else {
			wasmBinaryFile = new URL('python.wasm', import.meta.url).toString();
		}
		function getBinary(file) {
			try {
				if (file == wasmBinaryFile && wasmBinary) {
					return new Uint8Array(wasmBinary);
				}
				if (readBinary) {
					return readBinary(file);
				} else {
					throw 'both async and sync fetching of the wasm failed';
				}
			} catch (err) {
				abort(err);
			}
		}
		function getBinaryPromise() {
			if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
				if (typeof fetch == 'function') {
					return fetch(wasmBinaryFile, { credentials: 'same-origin' })
						.then(function (response) {
							if (!response['ok']) {
								throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
							}
							return response['arrayBuffer']();
						})
						.catch(function () {
							return getBinary(wasmBinaryFile);
						});
				}
			}
			return Promise.resolve().then(function () {
				return getBinary(wasmBinaryFile);
			});
		}
		function createWasm() {
			var info = { a: asmLibraryArg };
			function receiveInstance(instance, module) {
				var exports = instance.exports;
				Module['asm'] = exports;
				wasmMemory = Module['asm']['Ga'];
				updateGlobalBufferAndViews(wasmMemory.buffer);
				wasmTable = Module['asm']['Ka'];
				addOnInit(Module['asm']['Ha']);
				removeRunDependency('wasm-instantiate');
			}
			addRunDependency('wasm-instantiate');
			function receiveInstantiationResult(result) {
				receiveInstance(result['instance']);
			}
			function instantiateArrayBuffer(receiver) {
				return getBinaryPromise()
					.then(function (binary) {
						return WebAssembly.instantiate(binary, info);
					})
					.then(function (instance) {
						return instance;
					})
					.then(receiver, function (reason) {
						err('failed to asynchronously prepare wasm: ' + reason);
						abort(reason);
					});
			}
			function instantiateAsync() {
				if (
					!wasmBinary &&
					typeof WebAssembly.instantiateStreaming == 'function' &&
					!isDataURI(wasmBinaryFile) &&
					typeof fetch == 'function'
				) {
					return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function (response) {
						var result = WebAssembly.instantiateStreaming(response, info);
						return result.then(receiveInstantiationResult, function (reason) {
							err('wasm streaming compile failed: ' + reason);
							err('falling back to ArrayBuffer instantiation');
							return instantiateArrayBuffer(receiveInstantiationResult);
						});
					});
				} else {
					return instantiateArrayBuffer(receiveInstantiationResult);
				}
			}
			if (Module['instantiateWasm']) {
				try {
					var exports = Module['instantiateWasm'](info, receiveInstance);
					return exports;
				} catch (e) {
					err('Module.instantiateWasm callback failed with error: ' + e);
					return false;
				}
			}
			instantiateAsync().catch(readyPromiseReject);
			return {};
		}
		var tempDouble;
		var tempI64;
		function _Py_CheckEmscriptenSignals_Helper() {
			if (!Module.Py_EmscriptenSignalBuffer) {
				return 0;
			}
			try {
				let result = Module.Py_EmscriptenSignalBuffer[0];
				Module.Py_EmscriptenSignalBuffer[0] = 0;
				return result;
			} catch (e) {
				return 0;
			}
		}
		function _Py_emscripten_runtime() {
			var info;
			if (typeof navigator == 'object') {
				info = navigator.userAgent;
			} else if (typeof process == 'object') {
				info = 'Node.js '.concat(process.version);
			} else {
				info = 'UNKNOWN';
			}
			var len = lengthBytesUTF8(info) + 1;
			var res = _malloc(len);
			stringToUTF8(info, res, len);
			return res;
		}
		function callRuntimeCallbacks(callbacks) {
			while (callbacks.length > 0) {
				var callback = callbacks.shift();
				if (typeof callback == 'function') {
					callback(Module);
					continue;
				}
				var func = callback.func;
				if (typeof func == 'number') {
					if (callback.arg === undefined) {
						getWasmTableEntry(func)();
					} else {
						getWasmTableEntry(func)(callback.arg);
					}
				} else {
					func(callback.arg === undefined ? null : callback.arg);
				}
			}
		}
		var wasmTableMirror = [];
		function getWasmTableEntry(funcPtr) {
			var func = wasmTableMirror[funcPtr];
			if (!func) {
				if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
				wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
			}
			return func;
		}
		function handleException(e) {
			if (e instanceof ExitStatus || e == 'unwind') {
				return EXITSTATUS;
			}
			quit_(1, e);
		}
		function ___call_sighandler(fp, sig) {
			getWasmTableEntry(fp)(sig);
		}
		function setErrNo(value) {
			HEAP32[___errno_location() >> 2] = value;
			return value;
		}
		function ___map_file(pathname, size) {
			setErrNo(63);
			return -1;
		}
		var PATH = {
			isAbs: (path) => path.charAt(0) === '/',
			splitPath: (filename) => {
				var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
				return splitPathRe.exec(filename).slice(1);
			},
			normalizeArray: (parts, allowAboveRoot) => {
				var up = 0;
				for (var i = parts.length - 1; i >= 0; i--) {
					var last = parts[i];
					if (last === '.') {
						parts.splice(i, 1);
					} else if (last === '..') {
						parts.splice(i, 1);
						up++;
					} else if (up) {
						parts.splice(i, 1);
						up--;
					}
				}
				if (allowAboveRoot) {
					for (; up; up--) {
						parts.unshift('..');
					}
				}
				return parts;
			},
			normalize: (path) => {
				var isAbsolute = PATH.isAbs(path),
					trailingSlash = path.substr(-1) === '/';
				path = PATH.normalizeArray(
					path.split('/').filter((p) => !!p),
					!isAbsolute
				).join('/');
				if (!path && !isAbsolute) {
					path = '.';
				}
				if (path && trailingSlash) {
					path += '/';
				}
				return (isAbsolute ? '/' : '') + path;
			},
			dirname: (path) => {
				var result = PATH.splitPath(path),
					root = result[0],
					dir = result[1];
				if (!root && !dir) {
					return '.';
				}
				if (dir) {
					dir = dir.substr(0, dir.length - 1);
				}
				return root + dir;
			},
			basename: (path) => {
				if (path === '/') return '/';
				path = PATH.normalize(path);
				path = path.replace(/\/$/, '');
				var lastSlash = path.lastIndexOf('/');
				if (lastSlash === -1) return path;
				return path.substr(lastSlash + 1);
			},
			join: function () {
				var paths = Array.prototype.slice.call(arguments, 0);
				return PATH.normalize(paths.join('/'));
			},
			join2: (l, r) => {
				return PATH.normalize(l + '/' + r);
			}
		};
		function getRandomDevice() {
			if (typeof crypto == 'object' && typeof crypto['getRandomValues'] == 'function') {
				var randomBuffer = new Uint8Array(1);
				return function () {
					crypto.getRandomValues(randomBuffer);
					return randomBuffer[0];
				};
			} else
				return function () {
					abort('randomDevice');
				};
		}
		var PATH_FS = {
			resolve: function () {
				var resolvedPath = '',
					resolvedAbsolute = false;
				for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
					var path = i >= 0 ? arguments[i] : FS.cwd();
					if (typeof path != 'string') {
						throw new TypeError('Arguments to path.resolve must be strings');
					} else if (!path) {
						return '';
					}
					resolvedPath = path + '/' + resolvedPath;
					resolvedAbsolute = PATH.isAbs(path);
				}
				resolvedPath = PATH.normalizeArray(
					resolvedPath.split('/').filter((p) => !!p),
					!resolvedAbsolute
				).join('/');
				return (resolvedAbsolute ? '/' : '') + resolvedPath || '.';
			},
			relative: (from, to) => {
				from = PATH_FS.resolve(from).substr(1);
				to = PATH_FS.resolve(to).substr(1);
				function trim(arr) {
					var start = 0;
					for (; start < arr.length; start++) {
						if (arr[start] !== '') break;
					}
					var end = arr.length - 1;
					for (; end >= 0; end--) {
						if (arr[end] !== '') break;
					}
					if (start > end) return [];
					return arr.slice(start, end - start + 1);
				}
				var fromParts = trim(from.split('/'));
				var toParts = trim(to.split('/'));
				var length = Math.min(fromParts.length, toParts.length);
				var samePartsLength = length;
				for (var i = 0; i < length; i++) {
					if (fromParts[i] !== toParts[i]) {
						samePartsLength = i;
						break;
					}
				}
				var outputParts = [];
				for (var i = samePartsLength; i < fromParts.length; i++) {
					outputParts.push('..');
				}
				outputParts = outputParts.concat(toParts.slice(samePartsLength));
				return outputParts.join('/');
			}
		};
		var TTY = {
			ttys: [],
			init: function () {},
			shutdown: function () {},
			register: function (dev, ops) {
				TTY.ttys[dev] = { input: [], output: [], ops: ops };
				FS.registerDevice(dev, TTY.stream_ops);
			},
			stream_ops: {
				open: function (stream) {
					var tty = TTY.ttys[stream.node.rdev];
					if (!tty) {
						throw new FS.ErrnoError(43);
					}
					stream.tty = tty;
					stream.seekable = false;
				},
				close: function (stream) {
					stream.tty.ops.flush(stream.tty);
				},
				flush: function (stream) {
					stream.tty.ops.flush(stream.tty);
				},
				read: function (stream, buffer, offset, length, pos) {
					if (!stream.tty || !stream.tty.ops.get_char) {
						throw new FS.ErrnoError(60);
					}
					var bytesRead = 0;
					for (var i = 0; i < length; i++) {
						var result;
						try {
							result = stream.tty.ops.get_char(stream.tty);
						} catch (e) {
							throw new FS.ErrnoError(29);
						}
						if (result === undefined && bytesRead === 0) {
							throw new FS.ErrnoError(6);
						}
						if (result === null || result === undefined) break;
						bytesRead++;
						buffer[offset + i] = result;
					}
					if (bytesRead) {
						stream.node.timestamp = Date.now();
					}
					return bytesRead;
				},
				write: function (stream, buffer, offset, length, pos) {
					if (!stream.tty || !stream.tty.ops.put_char) {
						throw new FS.ErrnoError(60);
					}
					try {
						for (var i = 0; i < length; i++) {
							stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
						}
					} catch (e) {
						throw new FS.ErrnoError(29);
					}
					if (length) {
						stream.node.timestamp = Date.now();
					}
					return i;
				}
			},
			default_tty_ops: {
				get_char: function (tty) {
					if (!tty.input.length) {
						var result = null;
						if (typeof window != 'undefined' && typeof window.prompt == 'function') {
							result = window.prompt('Input: ');
							if (result !== null) {
								result += '\n';
							}
						} else if (typeof readline == 'function') {
							result = readline();
							if (result !== null) {
								result += '\n';
							}
						}
						if (!result) {
							return null;
						}
						tty.input = intArrayFromString(result, true);
					}
					return tty.input.shift();
				},
				put_char: function (tty, val) {
					if (val === null || val === 10) {
						out(UTF8ArrayToString(tty.output, 0));
						tty.output = [];
					} else {
						if (val != 0) tty.output.push(val);
					}
				},
				flush: function (tty) {
					if (tty.output && tty.output.length > 0) {
						out(UTF8ArrayToString(tty.output, 0));
						tty.output = [];
					}
				}
			},
			default_tty1_ops: {
				put_char: function (tty, val) {
					if (val === null || val === 10) {
						err(UTF8ArrayToString(tty.output, 0));
						tty.output = [];
					} else {
						if (val != 0) tty.output.push(val);
					}
				},
				flush: function (tty) {
					if (tty.output && tty.output.length > 0) {
						err(UTF8ArrayToString(tty.output, 0));
						tty.output = [];
					}
				}
			}
		};
		function zeroMemory(address, size) {
			HEAPU8.fill(0, address, address + size);
		}
		function alignMemory(size, alignment) {
			return Math.ceil(size / alignment) * alignment;
		}
		function mmapAlloc(size) {
			size = alignMemory(size, 65536);
			var ptr = _emscripten_builtin_memalign(65536, size);
			if (!ptr) return 0;
			zeroMemory(ptr, size);
			return ptr;
		}
		var MEMFS = {
			ops_table: null,
			mount: function (mount) {
				return MEMFS.createNode(null, '/', 16384 | 511, 0);
			},
			createNode: function (parent, name, mode, dev) {
				if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
					throw new FS.ErrnoError(63);
				}
				if (!MEMFS.ops_table) {
					MEMFS.ops_table = {
						dir: {
							node: {
								getattr: MEMFS.node_ops.getattr,
								setattr: MEMFS.node_ops.setattr,
								lookup: MEMFS.node_ops.lookup,
								mknod: MEMFS.node_ops.mknod,
								rename: MEMFS.node_ops.rename,
								unlink: MEMFS.node_ops.unlink,
								rmdir: MEMFS.node_ops.rmdir,
								readdir: MEMFS.node_ops.readdir,
								symlink: MEMFS.node_ops.symlink
							},
							stream: { llseek: MEMFS.stream_ops.llseek }
						},
						file: {
							node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr },
							stream: {
								llseek: MEMFS.stream_ops.llseek,
								read: MEMFS.stream_ops.read,
								write: MEMFS.stream_ops.write,
								allocate: MEMFS.stream_ops.allocate,
								mmap: MEMFS.stream_ops.mmap,
								msync: MEMFS.stream_ops.msync
							}
						},
						link: {
							node: {
								getattr: MEMFS.node_ops.getattr,
								setattr: MEMFS.node_ops.setattr,
								readlink: MEMFS.node_ops.readlink
							},
							stream: {}
						},
						chrdev: {
							node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr },
							stream: FS.chrdev_stream_ops
						}
					};
				}
				var node = FS.createNode(parent, name, mode, dev);
				if (FS.isDir(node.mode)) {
					node.node_ops = MEMFS.ops_table.dir.node;
					node.stream_ops = MEMFS.ops_table.dir.stream;
					node.contents = {};
				} else if (FS.isFile(node.mode)) {
					node.node_ops = MEMFS.ops_table.file.node;
					node.stream_ops = MEMFS.ops_table.file.stream;
					node.usedBytes = 0;
					node.contents = null;
				} else if (FS.isLink(node.mode)) {
					node.node_ops = MEMFS.ops_table.link.node;
					node.stream_ops = MEMFS.ops_table.link.stream;
				} else if (FS.isChrdev(node.mode)) {
					node.node_ops = MEMFS.ops_table.chrdev.node;
					node.stream_ops = MEMFS.ops_table.chrdev.stream;
				}
				node.timestamp = Date.now();
				if (parent) {
					parent.contents[name] = node;
					parent.timestamp = node.timestamp;
				}
				return node;
			},
			getFileDataAsTypedArray: function (node) {
				if (!node.contents) return new Uint8Array(0);
				if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
				return new Uint8Array(node.contents);
			},
			expandFileStorage: function (node, newCapacity) {
				var prevCapacity = node.contents ? node.contents.length : 0;
				if (prevCapacity >= newCapacity) return;
				var CAPACITY_DOUBLING_MAX = 1024 * 1024;
				newCapacity = Math.max(
					newCapacity,
					(prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>> 0
				);
				if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
				var oldContents = node.contents;
				node.contents = new Uint8Array(newCapacity);
				if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
			},
			resizeFileStorage: function (node, newSize) {
				if (node.usedBytes == newSize) return;
				if (newSize == 0) {
					node.contents = null;
					node.usedBytes = 0;
				} else {
					var oldContents = node.contents;
					node.contents = new Uint8Array(newSize);
					if (oldContents) {
						node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
					}
					node.usedBytes = newSize;
				}
			},
			node_ops: {
				getattr: function (node) {
					var attr = {};
					attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
					attr.ino = node.id;
					attr.mode = node.mode;
					attr.nlink = 1;
					attr.uid = 0;
					attr.gid = 0;
					attr.rdev = node.rdev;
					if (FS.isDir(node.mode)) {
						attr.size = 4096;
					} else if (FS.isFile(node.mode)) {
						attr.size = node.usedBytes;
					} else if (FS.isLink(node.mode)) {
						attr.size = node.link.length;
					} else {
						attr.size = 0;
					}
					attr.atime = new Date(node.timestamp);
					attr.mtime = new Date(node.timestamp);
					attr.ctime = new Date(node.timestamp);
					attr.blksize = 4096;
					attr.blocks = Math.ceil(attr.size / attr.blksize);
					return attr;
				},
				setattr: function (node, attr) {
					if (attr.mode !== undefined) {
						node.mode = attr.mode;
					}
					if (attr.timestamp !== undefined) {
						node.timestamp = attr.timestamp;
					}
					if (attr.size !== undefined) {
						MEMFS.resizeFileStorage(node, attr.size);
					}
				},
				lookup: function (parent, name) {
					throw FS.genericErrors[44];
				},
				mknod: function (parent, name, mode, dev) {
					return MEMFS.createNode(parent, name, mode, dev);
				},
				rename: function (old_node, new_dir, new_name) {
					if (FS.isDir(old_node.mode)) {
						var new_node;
						try {
							new_node = FS.lookupNode(new_dir, new_name);
						} catch (e) {}
						if (new_node) {
							for (var i in new_node.contents) {
								throw new FS.ErrnoError(55);
							}
						}
					}
					delete old_node.parent.contents[old_node.name];
					old_node.parent.timestamp = Date.now();
					old_node.name = new_name;
					new_dir.contents[new_name] = old_node;
					new_dir.timestamp = old_node.parent.timestamp;
					old_node.parent = new_dir;
				},
				unlink: function (parent, name) {
					delete parent.contents[name];
					parent.timestamp = Date.now();
				},
				rmdir: function (parent, name) {
					var node = FS.lookupNode(parent, name);
					for (var i in node.contents) {
						throw new FS.ErrnoError(55);
					}
					delete parent.contents[name];
					parent.timestamp = Date.now();
				},
				readdir: function (node) {
					var entries = ['.', '..'];
					for (var key in node.contents) {
						if (!node.contents.hasOwnProperty(key)) {
							continue;
						}
						entries.push(key);
					}
					return entries;
				},
				symlink: function (parent, newname, oldpath) {
					var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
					node.link = oldpath;
					return node;
				},
				readlink: function (node) {
					if (!FS.isLink(node.mode)) {
						throw new FS.ErrnoError(28);
					}
					return node.link;
				}
			},
			stream_ops: {
				read: function (stream, buffer, offset, length, position) {
					var contents = stream.node.contents;
					if (position >= stream.node.usedBytes) return 0;
					var size = Math.min(stream.node.usedBytes - position, length);
					if (size > 8 && contents.subarray) {
						buffer.set(contents.subarray(position, position + size), offset);
					} else {
						for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
					}
					return size;
				},
				write: function (stream, buffer, offset, length, position, canOwn) {
					if (buffer.buffer === HEAP8.buffer) {
						canOwn = false;
					}
					if (!length) return 0;
					var node = stream.node;
					node.timestamp = Date.now();
					if (buffer.subarray && (!node.contents || node.contents.subarray)) {
						if (canOwn) {
							node.contents = buffer.subarray(offset, offset + length);
							node.usedBytes = length;
							return length;
						} else if (node.usedBytes === 0 && position === 0) {
							node.contents = buffer.slice(offset, offset + length);
							node.usedBytes = length;
							return length;
						} else if (position + length <= node.usedBytes) {
							node.contents.set(buffer.subarray(offset, offset + length), position);
							return length;
						}
					}
					MEMFS.expandFileStorage(node, position + length);
					if (node.contents.subarray && buffer.subarray) {
						node.contents.set(buffer.subarray(offset, offset + length), position);
					} else {
						for (var i = 0; i < length; i++) {
							node.contents[position + i] = buffer[offset + i];
						}
					}
					node.usedBytes = Math.max(node.usedBytes, position + length);
					return length;
				},
				llseek: function (stream, offset, whence) {
					var position = offset;
					if (whence === 1) {
						position += stream.position;
					} else if (whence === 2) {
						if (FS.isFile(stream.node.mode)) {
							position += stream.node.usedBytes;
						}
					}
					if (position < 0) {
						throw new FS.ErrnoError(28);
					}
					return position;
				},
				allocate: function (stream, offset, length) {
					MEMFS.expandFileStorage(stream.node, offset + length);
					stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
				},
				mmap: function (stream, address, length, position, prot, flags) {
					if (address !== 0) {
						throw new FS.ErrnoError(28);
					}
					if (!FS.isFile(stream.node.mode)) {
						throw new FS.ErrnoError(43);
					}
					var ptr;
					var allocated;
					var contents = stream.node.contents;
					if (!(flags & 2) && contents.buffer === buffer) {
						allocated = false;
						ptr = contents.byteOffset;
					} else {
						if (position > 0 || position + length < contents.length) {
							if (contents.subarray) {
								contents = contents.subarray(position, position + length);
							} else {
								contents = Array.prototype.slice.call(contents, position, position + length);
							}
						}
						allocated = true;
						ptr = mmapAlloc(length);
						if (!ptr) {
							throw new FS.ErrnoError(48);
						}
						HEAP8.set(contents, ptr);
					}
					return { ptr: ptr, allocated: allocated };
				},
				msync: function (stream, buffer, offset, length, mmapFlags) {
					if (!FS.isFile(stream.node.mode)) {
						throw new FS.ErrnoError(43);
					}
					if (mmapFlags & 2) {
						return 0;
					}
					var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
					return 0;
				}
			}
		};
		function asyncLoad(url, onload, onerror, noRunDep) {
			var dep = !noRunDep ? getUniqueRunDependency('al ' + url) : '';
			readAsync(
				url,
				function (arrayBuffer) {
					assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
					onload(new Uint8Array(arrayBuffer));
					if (dep) removeRunDependency(dep);
				},
				function (event) {
					if (onerror) {
						onerror();
					} else {
						throw 'Loading data file "' + url + '" failed.';
					}
				}
			);
			if (dep) addRunDependency(dep);
		}
		var IDBFS = {
			dbs: {},
			indexedDB: () => {
				if (typeof indexedDB != 'undefined') return indexedDB;
				var ret = null;
				if (typeof window == 'object')
					ret =
						window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
				assert(ret, 'IDBFS used, but indexedDB not supported');
				return ret;
			},
			DB_VERSION: 21,
			DB_STORE_NAME: 'FILE_DATA',
			mount: function (mount) {
				return MEMFS.mount.apply(null, arguments);
			},
			syncfs: (mount, populate, callback) => {
				IDBFS.getLocalSet(mount, (err, local) => {
					if (err) return callback(err);
					IDBFS.getRemoteSet(mount, (err, remote) => {
						if (err) return callback(err);
						var src = populate ? remote : local;
						var dst = populate ? local : remote;
						IDBFS.reconcile(src, dst, callback);
					});
				});
			},
			quit: () => {
				Object.values(IDBFS.dbs).forEach((value) => value.close());
				IDBFS.dbs = {};
			},
			getDB: (name, callback) => {
				var db = IDBFS.dbs[name];
				if (db) {
					return callback(null, db);
				}
				var req;
				try {
					req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
				} catch (e) {
					return callback(e);
				}
				if (!req) {
					return callback('Unable to connect to IndexedDB');
				}
				req.onupgradeneeded = (e) => {
					var db = e.target.result;
					var transaction = e.target.transaction;
					var fileStore;
					if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
						fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
					} else {
						fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
					}
					if (!fileStore.indexNames.contains('timestamp')) {
						fileStore.createIndex('timestamp', 'timestamp', { unique: false });
					}
				};
				req.onsuccess = () => {
					db = req.result;
					IDBFS.dbs[name] = db;
					callback(null, db);
				};
				req.onerror = (e) => {
					callback(this.error);
					e.preventDefault();
				};
			},
			getLocalSet: (mount, callback) => {
				var entries = {};
				function isRealDir(p) {
					return p !== '.' && p !== '..';
				}
				function toAbsolute(root) {
					return (p) => {
						return PATH.join2(root, p);
					};
				}
				var check = FS.readdir(mount.mountpoint)
					.filter(isRealDir)
					.map(toAbsolute(mount.mountpoint));
				while (check.length) {
					var path = check.pop();
					var stat;
					try {
						stat = FS.stat(path);
					} catch (e) {
						return callback(e);
					}
					if (FS.isDir(stat.mode)) {
						check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
					}
					entries[path] = { timestamp: stat.mtime };
				}
				return callback(null, { type: 'local', entries: entries });
			},
			getRemoteSet: (mount, callback) => {
				var entries = {};
				IDBFS.getDB(mount.mountpoint, (err, db) => {
					if (err) return callback(err);
					try {
						var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
						transaction.onerror = (e) => {
							callback(this.error);
							e.preventDefault();
						};
						var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
						var index = store.index('timestamp');
						index.openKeyCursor().onsuccess = (event) => {
							var cursor = event.target.result;
							if (!cursor) {
								return callback(null, { type: 'remote', db: db, entries: entries });
							}
							entries[cursor.primaryKey] = { timestamp: cursor.key };
							cursor.continue();
						};
					} catch (e) {
						return callback(e);
					}
				});
			},
			loadLocalEntry: (path, callback) => {
				var stat, node;
				try {
					var lookup = FS.lookupPath(path);
					node = lookup.node;
					stat = FS.stat(path);
				} catch (e) {
					return callback(e);
				}
				if (FS.isDir(stat.mode)) {
					return callback(null, { timestamp: stat.mtime, mode: stat.mode });
				} else if (FS.isFile(stat.mode)) {
					node.contents = MEMFS.getFileDataAsTypedArray(node);
					return callback(null, {
						timestamp: stat.mtime,
						mode: stat.mode,
						contents: node.contents
					});
				} else {
					return callback(new Error('node type not supported'));
				}
			},
			storeLocalEntry: (path, entry, callback) => {
				try {
					if (FS.isDir(entry['mode'])) {
						FS.mkdirTree(path, entry['mode']);
					} else if (FS.isFile(entry['mode'])) {
						FS.writeFile(path, entry['contents'], { canOwn: true });
					} else {
						return callback(new Error('node type not supported'));
					}
					FS.chmod(path, entry['mode']);
					FS.utime(path, entry['timestamp'], entry['timestamp']);
				} catch (e) {
					return callback(e);
				}
				callback(null);
			},
			removeLocalEntry: (path, callback) => {
				try {
					var lookup = FS.lookupPath(path);
					var stat = FS.stat(path);
					if (FS.isDir(stat.mode)) {
						FS.rmdir(path);
					} else if (FS.isFile(stat.mode)) {
						FS.unlink(path);
					}
				} catch (e) {
					return callback(e);
				}
				callback(null);
			},
			loadRemoteEntry: (store, path, callback) => {
				var req = store.get(path);
				req.onsuccess = (event) => {
					callback(null, event.target.result);
				};
				req.onerror = (e) => {
					callback(this.error);
					e.preventDefault();
				};
			},
			storeRemoteEntry: (store, path, entry, callback) => {
				try {
					var req = store.put(entry, path);
				} catch (e) {
					callback(e);
					return;
				}
				req.onsuccess = () => {
					callback(null);
				};
				req.onerror = (e) => {
					callback(this.error);
					e.preventDefault();
				};
			},
			removeRemoteEntry: (store, path, callback) => {
				var req = store.delete(path);
				req.onsuccess = () => {
					callback(null);
				};
				req.onerror = (e) => {
					callback(this.error);
					e.preventDefault();
				};
			},
			reconcile: (src, dst, callback) => {
				var total = 0;
				var create = [];
				Object.keys(src.entries).forEach(function (key) {
					var e = src.entries[key];
					var e2 = dst.entries[key];
					if (!e2 || e['timestamp'].getTime() != e2['timestamp'].getTime()) {
						create.push(key);
						total++;
					}
				});
				var remove = [];
				Object.keys(dst.entries).forEach(function (key) {
					if (!src.entries[key]) {
						remove.push(key);
						total++;
					}
				});
				if (!total) {
					return callback(null);
				}
				var errored = false;
				var db = src.type === 'remote' ? src.db : dst.db;
				var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
				var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
				function done(err) {
					if (err && !errored) {
						errored = true;
						return callback(err);
					}
				}
				transaction.onerror = (e) => {
					done(this.error);
					e.preventDefault();
				};
				transaction.oncomplete = (e) => {
					if (!errored) {
						callback(null);
					}
				};
				create.sort().forEach((path) => {
					if (dst.type === 'local') {
						IDBFS.loadRemoteEntry(store, path, (err, entry) => {
							if (err) return done(err);
							IDBFS.storeLocalEntry(path, entry, done);
						});
					} else {
						IDBFS.loadLocalEntry(path, (err, entry) => {
							if (err) return done(err);
							IDBFS.storeRemoteEntry(store, path, entry, done);
						});
					}
				});
				remove
					.sort()
					.reverse()
					.forEach((path) => {
						if (dst.type === 'local') {
							IDBFS.removeLocalEntry(path, done);
						} else {
							IDBFS.removeRemoteEntry(store, path, done);
						}
					});
			}
		};
		var WORKERFS = {
			DIR_MODE: 16895,
			FILE_MODE: 33279,
			reader: null,
			mount: function (mount) {
				assert(ENVIRONMENT_IS_WORKER);
				if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync();
				var root = WORKERFS.createNode(null, '/', WORKERFS.DIR_MODE, 0);
				var createdParents = {};
				function ensureParent(path) {
					var parts = path.split('/');
					var parent = root;
					for (var i = 0; i < parts.length - 1; i++) {
						var curr = parts.slice(0, i + 1).join('/');
						if (!createdParents[curr]) {
							createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0);
						}
						parent = createdParents[curr];
					}
					return parent;
				}
				function base(path) {
					var parts = path.split('/');
					return parts[parts.length - 1];
				}
				Array.prototype.forEach.call(mount.opts['files'] || [], function (file) {
					WORKERFS.createNode(
						ensureParent(file.name),
						base(file.name),
						WORKERFS.FILE_MODE,
						0,
						file,
						file.lastModifiedDate
					);
				});
				(mount.opts['blobs'] || []).forEach(function (obj) {
					WORKERFS.createNode(
						ensureParent(obj['name']),
						base(obj['name']),
						WORKERFS.FILE_MODE,
						0,
						obj['data']
					);
				});
				(mount.opts['packages'] || []).forEach(function (pack) {
					pack['metadata'].files.forEach(function (file) {
						var name = file.filename.substr(1);
						WORKERFS.createNode(
							ensureParent(name),
							base(name),
							WORKERFS.FILE_MODE,
							0,
							pack['blob'].slice(file.start, file.end)
						);
					});
				});
				return root;
			},
			createNode: function (parent, name, mode, dev, contents, mtime) {
				var node = FS.createNode(parent, name, mode);
				node.mode = mode;
				node.node_ops = WORKERFS.node_ops;
				node.stream_ops = WORKERFS.stream_ops;
				node.timestamp = (mtime || new Date()).getTime();
				assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
				if (mode === WORKERFS.FILE_MODE) {
					node.size = contents.size;
					node.contents = contents;
				} else {
					node.size = 4096;
					node.contents = {};
				}
				if (parent) {
					parent.contents[name] = node;
				}
				return node;
			},
			node_ops: {
				getattr: function (node) {
					return {
						dev: 1,
						ino: node.id,
						mode: node.mode,
						nlink: 1,
						uid: 0,
						gid: 0,
						rdev: undefined,
						size: node.size,
						atime: new Date(node.timestamp),
						mtime: new Date(node.timestamp),
						ctime: new Date(node.timestamp),
						blksize: 4096,
						blocks: Math.ceil(node.size / 4096)
					};
				},
				setattr: function (node, attr) {
					if (attr.mode !== undefined) {
						node.mode = attr.mode;
					}
					if (attr.timestamp !== undefined) {
						node.timestamp = attr.timestamp;
					}
				},
				lookup: function (parent, name) {
					throw new FS.ErrnoError(44);
				},
				mknod: function (parent, name, mode, dev) {
					throw new FS.ErrnoError(63);
				},
				rename: function (oldNode, newDir, newName) {
					throw new FS.ErrnoError(63);
				},
				unlink: function (parent, name) {
					throw new FS.ErrnoError(63);
				},
				rmdir: function (parent, name) {
					throw new FS.ErrnoError(63);
				},
				readdir: function (node) {
					var entries = ['.', '..'];
					for (var key in node.contents) {
						if (!node.contents.hasOwnProperty(key)) {
							continue;
						}
						entries.push(key);
					}
					return entries;
				},
				symlink: function (parent, newName, oldPath) {
					throw new FS.ErrnoError(63);
				},
				readlink: function (node) {
					throw new FS.ErrnoError(63);
				}
			},
			stream_ops: {
				read: function (stream, buffer, offset, length, position) {
					if (position >= stream.node.size) return 0;
					var chunk = stream.node.contents.slice(position, position + length);
					var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
					buffer.set(new Uint8Array(ab), offset);
					return chunk.size;
				},
				write: function (stream, buffer, offset, length, position) {
					throw new FS.ErrnoError(29);
				},
				llseek: function (stream, offset, whence) {
					var position = offset;
					if (whence === 1) {
						position += stream.position;
					} else if (whence === 2) {
						if (FS.isFile(stream.node.mode)) {
							position += stream.node.size;
						}
					}
					if (position < 0) {
						throw new FS.ErrnoError(28);
					}
					return position;
				}
			}
		};
		var ERRNO_CODES = {};
		var PROXYFS = {
			mount: function (mount) {
				return PROXYFS.createNode(null, '/', mount.opts.fs.lstat(mount.opts.root).mode, 0);
			},
			createNode: function (parent, name, mode, dev) {
				if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
					throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
				}
				var node = FS.createNode(parent, name, mode);
				node.node_ops = PROXYFS.node_ops;
				node.stream_ops = PROXYFS.stream_ops;
				return node;
			},
			realPath: function (node) {
				var parts = [];
				while (node.parent !== node) {
					parts.push(node.name);
					node = node.parent;
				}
				parts.push(node.mount.opts.root);
				parts.reverse();
				return PATH.join.apply(null, parts);
			},
			node_ops: {
				getattr: function (node) {
					var path = PROXYFS.realPath(node);
					var stat;
					try {
						stat = node.mount.opts.fs.lstat(path);
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
					return {
						dev: stat.dev,
						ino: stat.ino,
						mode: stat.mode,
						nlink: stat.nlink,
						uid: stat.uid,
						gid: stat.gid,
						rdev: stat.rdev,
						size: stat.size,
						atime: stat.atime,
						mtime: stat.mtime,
						ctime: stat.ctime,
						blksize: stat.blksize,
						blocks: stat.blocks
					};
				},
				setattr: function (node, attr) {
					var path = PROXYFS.realPath(node);
					try {
						if (attr.mode !== undefined) {
							node.mount.opts.fs.chmod(path, attr.mode);
							node.mode = attr.mode;
						}
						if (attr.timestamp !== undefined) {
							var date = new Date(attr.timestamp);
							node.mount.opts.fs.utime(path, date, date);
						}
						if (attr.size !== undefined) {
							node.mount.opts.fs.truncate(path, attr.size);
						}
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
				},
				lookup: function (parent, name) {
					try {
						var path = PATH.join2(PROXYFS.realPath(parent), name);
						var mode = parent.mount.opts.fs.lstat(path).mode;
						var node = PROXYFS.createNode(parent, name, mode);
						return node;
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
				},
				mknod: function (parent, name, mode, dev) {
					var node = PROXYFS.createNode(parent, name, mode, dev);
					var path = PROXYFS.realPath(node);
					try {
						if (FS.isDir(node.mode)) {
							node.mount.opts.fs.mkdir(path, node.mode);
						} else {
							node.mount.opts.fs.writeFile(path, '', { mode: node.mode });
						}
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
					return node;
				},
				rename: function (oldNode, newDir, newName) {
					var oldPath = PROXYFS.realPath(oldNode);
					var newPath = PATH.join2(PROXYFS.realPath(newDir), newName);
					try {
						oldNode.mount.opts.fs.rename(oldPath, newPath);
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
				},
				unlink: function (parent, name) {
					var path = PATH.join2(PROXYFS.realPath(parent), name);
					try {
						parent.mount.opts.fs.unlink(path);
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
				},
				rmdir: function (parent, name) {
					var path = PATH.join2(PROXYFS.realPath(parent), name);
					try {
						parent.mount.opts.fs.rmdir(path);
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
				},
				readdir: function (node) {
					var path = PROXYFS.realPath(node);
					try {
						return node.mount.opts.fs.readdir(path);
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
				},
				symlink: function (parent, newName, oldPath) {
					var newPath = PATH.join2(PROXYFS.realPath(parent), newName);
					try {
						parent.mount.opts.fs.symlink(oldPath, newPath);
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
				},
				readlink: function (node) {
					var path = PROXYFS.realPath(node);
					try {
						return node.mount.opts.fs.readlink(path);
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
				}
			},
			stream_ops: {
				open: function (stream) {
					var path = PROXYFS.realPath(stream.node);
					try {
						stream.nfd = stream.node.mount.opts.fs.open(path, stream.flags);
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
				},
				close: function (stream) {
					try {
						stream.node.mount.opts.fs.close(stream.nfd);
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
				},
				read: function (stream, buffer, offset, length, position) {
					try {
						return stream.node.mount.opts.fs.read(stream.nfd, buffer, offset, length, position);
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
				},
				write: function (stream, buffer, offset, length, position) {
					try {
						return stream.node.mount.opts.fs.write(stream.nfd, buffer, offset, length, position);
					} catch (e) {
						if (!e.code) throw e;
						throw new FS.ErrnoError(ERRNO_CODES[e.code]);
					}
				},
				llseek: function (stream, offset, whence) {
					var position = offset;
					if (whence === 1) {
						position += stream.position;
					} else if (whence === 2) {
						if (FS.isFile(stream.node.mode)) {
							try {
								var stat = stream.node.node_ops.getattr(stream.node);
								position += stat.size;
							} catch (e) {
								throw new FS.ErrnoError(ERRNO_CODES[e.code]);
							}
						}
					}
					if (position < 0) {
						throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
					}
					return position;
				}
			}
		};
		var FS = {
			root: null,
			mounts: [],
			devices: {},
			streams: [],
			nextInode: 1,
			nameTable: null,
			currentPath: '/',
			initialized: false,
			ignorePermissions: true,
			ErrnoError: null,
			genericErrors: {},
			filesystems: null,
			syncFSRequests: 0,
			lookupPath: (path, opts = {}) => {
				path = PATH_FS.resolve(FS.cwd(), path);
				if (!path) return { path: '', node: null };
				var defaults = { follow_mount: true, recurse_count: 0 };
				opts = Object.assign(defaults, opts);
				if (opts.recurse_count > 8) {
					throw new FS.ErrnoError(32);
				}
				var parts = PATH.normalizeArray(
					path.split('/').filter((p) => !!p),
					false
				);
				var current = FS.root;
				var current_path = '/';
				for (var i = 0; i < parts.length; i++) {
					var islast = i === parts.length - 1;
					if (islast && opts.parent) {
						break;
					}
					current = FS.lookupNode(current, parts[i]);
					current_path = PATH.join2(current_path, parts[i]);
					if (FS.isMountpoint(current)) {
						if (!islast || (islast && opts.follow_mount)) {
							current = current.mounted.root;
						}
					}
					if (!islast || opts.follow) {
						var count = 0;
						while (FS.isLink(current.mode)) {
							var link = FS.readlink(current_path);
							current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
							var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count + 1 });
							current = lookup.node;
							if (count++ > 40) {
								throw new FS.ErrnoError(32);
							}
						}
					}
				}
				return { path: current_path, node: current };
			},
			getPath: (node) => {
				var path;
				while (true) {
					if (FS.isRoot(node)) {
						var mount = node.mount.mountpoint;
						if (!path) return mount;
						return mount[mount.length - 1] !== '/' ? mount + '/' + path : mount + path;
					}
					path = path ? node.name + '/' + path : node.name;
					node = node.parent;
				}
			},
			hashName: (parentid, name) => {
				var hash = 0;
				for (var i = 0; i < name.length; i++) {
					hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
				}
				return ((parentid + hash) >>> 0) % FS.nameTable.length;
			},
			hashAddNode: (node) => {
				var hash = FS.hashName(node.parent.id, node.name);
				node.name_next = FS.nameTable[hash];
				FS.nameTable[hash] = node;
			},
			hashRemoveNode: (node) => {
				var hash = FS.hashName(node.parent.id, node.name);
				if (FS.nameTable[hash] === node) {
					FS.nameTable[hash] = node.name_next;
				} else {
					var current = FS.nameTable[hash];
					while (current) {
						if (current.name_next === node) {
							current.name_next = node.name_next;
							break;
						}
						current = current.name_next;
					}
				}
			},
			lookupNode: (parent, name) => {
				var errCode = FS.mayLookup(parent);
				if (errCode) {
					throw new FS.ErrnoError(errCode, parent);
				}
				var hash = FS.hashName(parent.id, name);
				for (var node = FS.nameTable[hash]; node; node = node.name_next) {
					var nodeName = node.name;
					if (node.parent.id === parent.id && nodeName === name) {
						return node;
					}
				}
				return FS.lookup(parent, name);
			},
			createNode: (parent, name, mode, rdev) => {
				var node = new FS.FSNode(parent, name, mode, rdev);
				FS.hashAddNode(node);
				return node;
			},
			destroyNode: (node) => {
				FS.hashRemoveNode(node);
			},
			isRoot: (node) => {
				return node === node.parent;
			},
			isMountpoint: (node) => {
				return !!node.mounted;
			},
			isFile: (mode) => {
				return (mode & 61440) === 32768;
			},
			isDir: (mode) => {
				return (mode & 61440) === 16384;
			},
			isLink: (mode) => {
				return (mode & 61440) === 40960;
			},
			isChrdev: (mode) => {
				return (mode & 61440) === 8192;
			},
			isBlkdev: (mode) => {
				return (mode & 61440) === 24576;
			},
			isFIFO: (mode) => {
				return (mode & 61440) === 4096;
			},
			isSocket: (mode) => {
				return (mode & 49152) === 49152;
			},
			flagModes: { r: 0, 'r+': 2, w: 577, 'w+': 578, a: 1089, 'a+': 1090 },
			modeStringToFlags: (str) => {
				var flags = FS.flagModes[str];
				if (typeof flags == 'undefined') {
					throw new Error('Unknown file open mode: ' + str);
				}
				return flags;
			},
			flagsToPermissionString: (flag) => {
				var perms = ['r', 'w', 'rw'][flag & 3];
				if (flag & 512) {
					perms += 'w';
				}
				return perms;
			},
			nodePermissions: (node, perms) => {
				if (FS.ignorePermissions) {
					return 0;
				}
				if (perms.includes('r') && !(node.mode & 292)) {
					return 2;
				} else if (perms.includes('w') && !(node.mode & 146)) {
					return 2;
				} else if (perms.includes('x') && !(node.mode & 73)) {
					return 2;
				}
				return 0;
			},
			mayLookup: (dir) => {
				var errCode = FS.nodePermissions(dir, 'x');
				if (errCode) return errCode;
				if (!dir.node_ops.lookup) return 2;
				return 0;
			},
			mayCreate: (dir, name) => {
				try {
					var node = FS.lookupNode(dir, name);
					return 20;
				} catch (e) {}
				return FS.nodePermissions(dir, 'wx');
			},
			mayDelete: (dir, name, isdir) => {
				var node;
				try {
					node = FS.lookupNode(dir, name);
				} catch (e) {
					return e.errno;
				}
				var errCode = FS.nodePermissions(dir, 'wx');
				if (errCode) {
					return errCode;
				}
				if (isdir) {
					if (!FS.isDir(node.mode)) {
						return 54;
					}
					if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
						return 10;
					}
				} else {
					if (FS.isDir(node.mode)) {
						return 31;
					}
				}
				return 0;
			},
			mayOpen: (node, flags) => {
				if (!node) {
					return 44;
				}
				if (FS.isLink(node.mode)) {
					return 32;
				} else if (FS.isDir(node.mode)) {
					if (FS.flagsToPermissionString(flags) !== 'r' || flags & 512) {
						return 31;
					}
				}
				return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
			},
			MAX_OPEN_FDS: 4096,
			nextfd: (fd_start = 0, fd_end = FS.MAX_OPEN_FDS) => {
				for (var fd = fd_start; fd <= fd_end; fd++) {
					if (!FS.streams[fd]) {
						return fd;
					}
				}
				throw new FS.ErrnoError(33);
			},
			getStream: (fd) => FS.streams[fd],
			createStream: (stream, fd_start, fd_end) => {
				if (!FS.FSStream) {
					FS.FSStream = function () {
						this.shared = {};
					};
					FS.FSStream.prototype = {
						object: {
							get: function () {
								return this.node;
							},
							set: function (val) {
								this.node = val;
							}
						},
						isRead: {
							get: function () {
								return (this.flags & 2097155) !== 1;
							}
						},
						isWrite: {
							get: function () {
								return (this.flags & 2097155) !== 0;
							}
						},
						isAppend: {
							get: function () {
								return this.flags & 1024;
							}
						},
						flags: {
							get: function () {
								return this.shared.flags;
							},
							set: function (val) {
								this.shared.flags = val;
							}
						},
						position: {
							get function() {
								return this.shared.position;
							},
							set: function (val) {
								this.shared.position = val;
							}
						}
					};
				}
				stream = Object.assign(new FS.FSStream(), stream);
				var fd = FS.nextfd(fd_start, fd_end);
				stream.fd = fd;
				FS.streams[fd] = stream;
				return stream;
			},
			closeStream: (fd) => {
				FS.streams[fd] = null;
			},
			chrdev_stream_ops: {
				open: (stream) => {
					var device = FS.getDevice(stream.node.rdev);
					stream.stream_ops = device.stream_ops;
					if (stream.stream_ops.open) {
						stream.stream_ops.open(stream);
					}
				},
				llseek: () => {
					throw new FS.ErrnoError(70);
				}
			},
			major: (dev) => dev >> 8,
			minor: (dev) => dev & 255,
			makedev: (ma, mi) => (ma << 8) | mi,
			registerDevice: (dev, ops) => {
				FS.devices[dev] = { stream_ops: ops };
			},
			getDevice: (dev) => FS.devices[dev],
			getMounts: (mount) => {
				var mounts = [];
				var check = [mount];
				while (check.length) {
					var m = check.pop();
					mounts.push(m);
					check.push.apply(check, m.mounts);
				}
				return mounts;
			},
			syncfs: (populate, callback) => {
				if (typeof populate == 'function') {
					callback = populate;
					populate = false;
				}
				FS.syncFSRequests++;
				if (FS.syncFSRequests > 1) {
					err(
						'warning: ' +
							FS.syncFSRequests +
							' FS.syncfs operations in flight at once, probably just doing extra work'
					);
				}
				var mounts = FS.getMounts(FS.root.mount);
				var completed = 0;
				function doCallback(errCode) {
					FS.syncFSRequests--;
					return callback(errCode);
				}
				function done(errCode) {
					if (errCode) {
						if (!done.errored) {
							done.errored = true;
							return doCallback(errCode);
						}
						return;
					}
					if (++completed >= mounts.length) {
						doCallback(null);
					}
				}
				mounts.forEach((mount) => {
					if (!mount.type.syncfs) {
						return done(null);
					}
					mount.type.syncfs(mount, populate, done);
				});
			},
			mount: (type, opts, mountpoint) => {
				var root = mountpoint === '/';
				var pseudo = !mountpoint;
				var node;
				if (root && FS.root) {
					throw new FS.ErrnoError(10);
				} else if (!root && !pseudo) {
					var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
					mountpoint = lookup.path;
					node = lookup.node;
					if (FS.isMountpoint(node)) {
						throw new FS.ErrnoError(10);
					}
					if (!FS.isDir(node.mode)) {
						throw new FS.ErrnoError(54);
					}
				}
				var mount = { type: type, opts: opts, mountpoint: mountpoint, mounts: [] };
				var mountRoot = type.mount(mount);
				mountRoot.mount = mount;
				mount.root = mountRoot;
				if (root) {
					FS.root = mountRoot;
				} else if (node) {
					node.mounted = mount;
					if (node.mount) {
						node.mount.mounts.push(mount);
					}
				}
				return mountRoot;
			},
			unmount: (mountpoint) => {
				var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
				if (!FS.isMountpoint(lookup.node)) {
					throw new FS.ErrnoError(28);
				}
				var node = lookup.node;
				var mount = node.mounted;
				var mounts = FS.getMounts(mount);
				Object.keys(FS.nameTable).forEach((hash) => {
					var current = FS.nameTable[hash];
					while (current) {
						var next = current.name_next;
						if (mounts.includes(current.mount)) {
							FS.destroyNode(current);
						}
						current = next;
					}
				});
				node.mounted = null;
				var idx = node.mount.mounts.indexOf(mount);
				node.mount.mounts.splice(idx, 1);
			},
			lookup: (parent, name) => {
				return parent.node_ops.lookup(parent, name);
			},
			mknod: (path, mode, dev) => {
				var lookup = FS.lookupPath(path, { parent: true });
				var parent = lookup.node;
				var name = PATH.basename(path);
				if (!name || name === '.' || name === '..') {
					throw new FS.ErrnoError(28);
				}
				var errCode = FS.mayCreate(parent, name);
				if (errCode) {
					throw new FS.ErrnoError(errCode);
				}
				if (!parent.node_ops.mknod) {
					throw new FS.ErrnoError(63);
				}
				return parent.node_ops.mknod(parent, name, mode, dev);
			},
			create: (path, mode) => {
				mode = mode !== undefined ? mode : 438;
				mode &= 4095;
				mode |= 32768;
				return FS.mknod(path, mode, 0);
			},
			mkdir: (path, mode) => {
				mode = mode !== undefined ? mode : 511;
				mode &= 511 | 512;
				mode |= 16384;
				return FS.mknod(path, mode, 0);
			},
			mkdirTree: (path, mode) => {
				var dirs = path.split('/');
				var d = '';
				for (var i = 0; i < dirs.length; ++i) {
					if (!dirs[i]) continue;
					d += '/' + dirs[i];
					try {
						FS.mkdir(d, mode);
					} catch (e) {
						if (e.errno != 20) throw e;
					}
				}
			},
			mkdev: (path, mode, dev) => {
				if (typeof dev == 'undefined') {
					dev = mode;
					mode = 438;
				}
				mode |= 8192;
				return FS.mknod(path, mode, dev);
			},
			symlink: (oldpath, newpath) => {
				if (!PATH_FS.resolve(oldpath)) {
					throw new FS.ErrnoError(44);
				}
				var lookup = FS.lookupPath(newpath, { parent: true });
				var parent = lookup.node;
				if (!parent) {
					throw new FS.ErrnoError(44);
				}
				var newname = PATH.basename(newpath);
				var errCode = FS.mayCreate(parent, newname);
				if (errCode) {
					throw new FS.ErrnoError(errCode);
				}
				if (!parent.node_ops.symlink) {
					throw new FS.ErrnoError(63);
				}
				return parent.node_ops.symlink(parent, newname, oldpath);
			},
			rename: (old_path, new_path) => {
				var old_dirname = PATH.dirname(old_path);
				var new_dirname = PATH.dirname(new_path);
				var old_name = PATH.basename(old_path);
				var new_name = PATH.basename(new_path);
				var lookup, old_dir, new_dir;
				lookup = FS.lookupPath(old_path, { parent: true });
				old_dir = lookup.node;
				lookup = FS.lookupPath(new_path, { parent: true });
				new_dir = lookup.node;
				if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
				if (old_dir.mount !== new_dir.mount) {
					throw new FS.ErrnoError(75);
				}
				var old_node = FS.lookupNode(old_dir, old_name);
				var relative = PATH_FS.relative(old_path, new_dirname);
				if (relative.charAt(0) !== '.') {
					throw new FS.ErrnoError(28);
				}
				relative = PATH_FS.relative(new_path, old_dirname);
				if (relative.charAt(0) !== '.') {
					throw new FS.ErrnoError(55);
				}
				var new_node;
				try {
					new_node = FS.lookupNode(new_dir, new_name);
				} catch (e) {}
				if (old_node === new_node) {
					return;
				}
				var isdir = FS.isDir(old_node.mode);
				var errCode = FS.mayDelete(old_dir, old_name, isdir);
				if (errCode) {
					throw new FS.ErrnoError(errCode);
				}
				errCode = new_node
					? FS.mayDelete(new_dir, new_name, isdir)
					: FS.mayCreate(new_dir, new_name);
				if (errCode) {
					throw new FS.ErrnoError(errCode);
				}
				if (!old_dir.node_ops.rename) {
					throw new FS.ErrnoError(63);
				}
				if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
					throw new FS.ErrnoError(10);
				}
				if (new_dir !== old_dir) {
					errCode = FS.nodePermissions(old_dir, 'w');
					if (errCode) {
						throw new FS.ErrnoError(errCode);
					}
				}
				FS.hashRemoveNode(old_node);
				try {
					old_dir.node_ops.rename(old_node, new_dir, new_name);
				} catch (e) {
					throw e;
				} finally {
					FS.hashAddNode(old_node);
				}
			},
			rmdir: (path) => {
				var lookup = FS.lookupPath(path, { parent: true });
				var parent = lookup.node;
				var name = PATH.basename(path);
				var node = FS.lookupNode(parent, name);
				var errCode = FS.mayDelete(parent, name, true);
				if (errCode) {
					throw new FS.ErrnoError(errCode);
				}
				if (!parent.node_ops.rmdir) {
					throw new FS.ErrnoError(63);
				}
				if (FS.isMountpoint(node)) {
					throw new FS.ErrnoError(10);
				}
				parent.node_ops.rmdir(parent, name);
				FS.destroyNode(node);
			},
			readdir: (path) => {
				var lookup = FS.lookupPath(path, { follow: true });
				var node = lookup.node;
				if (!node.node_ops.readdir) {
					throw new FS.ErrnoError(54);
				}
				return node.node_ops.readdir(node);
			},
			unlink: (path) => {
				var lookup = FS.lookupPath(path, { parent: true });
				var parent = lookup.node;
				if (!parent) {
					throw new FS.ErrnoError(44);
				}
				var name = PATH.basename(path);
				var node = FS.lookupNode(parent, name);
				var errCode = FS.mayDelete(parent, name, false);
				if (errCode) {
					throw new FS.ErrnoError(errCode);
				}
				if (!parent.node_ops.unlink) {
					throw new FS.ErrnoError(63);
				}
				if (FS.isMountpoint(node)) {
					throw new FS.ErrnoError(10);
				}
				parent.node_ops.unlink(parent, name);
				FS.destroyNode(node);
			},
			readlink: (path) => {
				var lookup = FS.lookupPath(path);
				var link = lookup.node;
				if (!link) {
					throw new FS.ErrnoError(44);
				}
				if (!link.node_ops.readlink) {
					throw new FS.ErrnoError(28);
				}
				return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
			},
			stat: (path, dontFollow) => {
				var lookup = FS.lookupPath(path, { follow: !dontFollow });
				var node = lookup.node;
				if (!node) {
					throw new FS.ErrnoError(44);
				}
				if (!node.node_ops.getattr) {
					throw new FS.ErrnoError(63);
				}
				return node.node_ops.getattr(node);
			},
			lstat: (path) => {
				return FS.stat(path, true);
			},
			chmod: (path, mode, dontFollow) => {
				var node;
				if (typeof path == 'string') {
					var lookup = FS.lookupPath(path, { follow: !dontFollow });
					node = lookup.node;
				} else {
					node = path;
				}
				if (!node.node_ops.setattr) {
					throw new FS.ErrnoError(63);
				}
				node.node_ops.setattr(node, {
					mode: (mode & 4095) | (node.mode & ~4095),
					timestamp: Date.now()
				});
			},
			lchmod: (path, mode) => {
				FS.chmod(path, mode, true);
			},
			fchmod: (fd, mode) => {
				var stream = FS.getStream(fd);
				if (!stream) {
					throw new FS.ErrnoError(8);
				}
				FS.chmod(stream.node, mode);
			},
			chown: (path, uid, gid, dontFollow) => {
				var node;
				if (typeof path == 'string') {
					var lookup = FS.lookupPath(path, { follow: !dontFollow });
					node = lookup.node;
				} else {
					node = path;
				}
				if (!node.node_ops.setattr) {
					throw new FS.ErrnoError(63);
				}
				node.node_ops.setattr(node, { timestamp: Date.now() });
			},
			lchown: (path, uid, gid) => {
				FS.chown(path, uid, gid, true);
			},
			fchown: (fd, uid, gid) => {
				var stream = FS.getStream(fd);
				if (!stream) {
					throw new FS.ErrnoError(8);
				}
				FS.chown(stream.node, uid, gid);
			},
			truncate: (path, len) => {
				if (len < 0) {
					throw new FS.ErrnoError(28);
				}
				var node;
				if (typeof path == 'string') {
					var lookup = FS.lookupPath(path, { follow: true });
					node = lookup.node;
				} else {
					node = path;
				}
				if (!node.node_ops.setattr) {
					throw new FS.ErrnoError(63);
				}
				if (FS.isDir(node.mode)) {
					throw new FS.ErrnoError(31);
				}
				if (!FS.isFile(node.mode)) {
					throw new FS.ErrnoError(28);
				}
				var errCode = FS.nodePermissions(node, 'w');
				if (errCode) {
					throw new FS.ErrnoError(errCode);
				}
				node.node_ops.setattr(node, { size: len, timestamp: Date.now() });
			},
			ftruncate: (fd, len) => {
				var stream = FS.getStream(fd);
				if (!stream) {
					throw new FS.ErrnoError(8);
				}
				if ((stream.flags & 2097155) === 0) {
					throw new FS.ErrnoError(28);
				}
				FS.truncate(stream.node, len);
			},
			utime: (path, atime, mtime) => {
				var lookup = FS.lookupPath(path, { follow: true });
				var node = lookup.node;
				node.node_ops.setattr(node, { timestamp: Math.max(atime, mtime) });
			},
			open: (path, flags, mode, fd_start, fd_end) => {
				if (path === '') {
					throw new FS.ErrnoError(44);
				}
				flags = typeof flags == 'string' ? FS.modeStringToFlags(flags) : flags;
				mode = typeof mode == 'undefined' ? 438 : mode;
				if (flags & 64) {
					mode = (mode & 4095) | 32768;
				} else {
					mode = 0;
				}
				var node;
				if (typeof path == 'object') {
					node = path;
				} else {
					path = PATH.normalize(path);
					try {
						var lookup = FS.lookupPath(path, { follow: !(flags & 131072) });
						node = lookup.node;
					} catch (e) {}
				}
				var created = false;
				if (flags & 64) {
					if (node) {
						if (flags & 128) {
							throw new FS.ErrnoError(20);
						}
					} else {
						node = FS.mknod(path, mode, 0);
						created = true;
					}
				}
				if (!node) {
					throw new FS.ErrnoError(44);
				}
				if (FS.isChrdev(node.mode)) {
					flags &= ~512;
				}
				if (flags & 65536 && !FS.isDir(node.mode)) {
					throw new FS.ErrnoError(54);
				}
				if (!created) {
					var errCode = FS.mayOpen(node, flags);
					if (errCode) {
						throw new FS.ErrnoError(errCode);
					}
				}
				if (flags & 512) {
					FS.truncate(node, 0);
				}
				flags &= ~(128 | 512 | 131072);
				var stream = FS.createStream(
					{
						node: node,
						path: FS.getPath(node),
						flags: flags,
						seekable: true,
						position: 0,
						stream_ops: node.stream_ops,
						ungotten: [],
						error: false
					},
					fd_start,
					fd_end
				);
				if (stream.stream_ops.open) {
					stream.stream_ops.open(stream);
				}
				if (Module['logReadFiles'] && !(flags & 1)) {
					if (!FS.readFiles) FS.readFiles = {};
					if (!(path in FS.readFiles)) {
						FS.readFiles[path] = 1;
					}
				}
				return stream;
			},
			close: (stream) => {
				if (FS.isClosed(stream)) {
					throw new FS.ErrnoError(8);
				}
				if (stream.getdents) stream.getdents = null;
				try {
					if (stream.stream_ops.close) {
						stream.stream_ops.close(stream);
					}
				} catch (e) {
					throw e;
				} finally {
					FS.closeStream(stream.fd);
				}
				stream.fd = null;
			},
			isClosed: (stream) => {
				return stream.fd === null;
			},
			llseek: (stream, offset, whence) => {
				if (FS.isClosed(stream)) {
					throw new FS.ErrnoError(8);
				}
				if (!stream.seekable || !stream.stream_ops.llseek) {
					throw new FS.ErrnoError(70);
				}
				if (whence != 0 && whence != 1 && whence != 2) {
					throw new FS.ErrnoError(28);
				}
				stream.position = stream.stream_ops.llseek(stream, offset, whence);
				stream.ungotten = [];
				return stream.position;
			},
			read: (stream, buffer, offset, length, position) => {
				if (length < 0 || position < 0) {
					throw new FS.ErrnoError(28);
				}
				if (FS.isClosed(stream)) {
					throw new FS.ErrnoError(8);
				}
				if ((stream.flags & 2097155) === 1) {
					throw new FS.ErrnoError(8);
				}
				if (FS.isDir(stream.node.mode)) {
					throw new FS.ErrnoError(31);
				}
				if (!stream.stream_ops.read) {
					throw new FS.ErrnoError(28);
				}
				var seeking = typeof position != 'undefined';
				if (!seeking) {
					position = stream.position;
				} else if (!stream.seekable) {
					throw new FS.ErrnoError(70);
				}
				var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
				if (!seeking) stream.position += bytesRead;
				return bytesRead;
			},
			write: (stream, buffer, offset, length, position, canOwn) => {
				if (length < 0 || position < 0) {
					throw new FS.ErrnoError(28);
				}
				if (FS.isClosed(stream)) {
					throw new FS.ErrnoError(8);
				}
				if ((stream.flags & 2097155) === 0) {
					throw new FS.ErrnoError(8);
				}
				if (FS.isDir(stream.node.mode)) {
					throw new FS.ErrnoError(31);
				}
				if (!stream.stream_ops.write) {
					throw new FS.ErrnoError(28);
				}
				if (stream.seekable && stream.flags & 1024) {
					FS.llseek(stream, 0, 2);
				}
				var seeking = typeof position != 'undefined';
				if (!seeking) {
					position = stream.position;
				} else if (!stream.seekable) {
					throw new FS.ErrnoError(70);
				}
				var bytesWritten = stream.stream_ops.write(
					stream,
					buffer,
					offset,
					length,
					position,
					canOwn
				);
				if (!seeking) stream.position += bytesWritten;
				return bytesWritten;
			},
			allocate: (stream, offset, length) => {
				if (FS.isClosed(stream)) {
					throw new FS.ErrnoError(8);
				}
				if (offset < 0 || length <= 0) {
					throw new FS.ErrnoError(28);
				}
				if ((stream.flags & 2097155) === 0) {
					throw new FS.ErrnoError(8);
				}
				if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
					throw new FS.ErrnoError(43);
				}
				if (!stream.stream_ops.allocate) {
					throw new FS.ErrnoError(138);
				}
				stream.stream_ops.allocate(stream, offset, length);
			},
			mmap: (stream, address, length, position, prot, flags) => {
				if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
					throw new FS.ErrnoError(2);
				}
				if ((stream.flags & 2097155) === 1) {
					throw new FS.ErrnoError(2);
				}
				if (!stream.stream_ops.mmap) {
					throw new FS.ErrnoError(43);
				}
				return stream.stream_ops.mmap(stream, address, length, position, prot, flags);
			},
			msync: (stream, buffer, offset, length, mmapFlags) => {
				if (!stream || !stream.stream_ops.msync) {
					return 0;
				}
				return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
			},
			munmap: (stream) => 0,
			ioctl: (stream, cmd, arg) => {
				if (!stream.stream_ops.ioctl) {
					throw new FS.ErrnoError(59);
				}
				return stream.stream_ops.ioctl(stream, cmd, arg);
			},
			readFile: (path, opts = {}) => {
				opts.flags = opts.flags || 0;
				opts.encoding = opts.encoding || 'binary';
				if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
					throw new Error('Invalid encoding type "' + opts.encoding + '"');
				}
				var ret;
				var stream = FS.open(path, opts.flags);
				var stat = FS.stat(path);
				var length = stat.size;
				var buf = new Uint8Array(length);
				FS.read(stream, buf, 0, length, 0);
				if (opts.encoding === 'utf8') {
					ret = UTF8ArrayToString(buf, 0);
				} else if (opts.encoding === 'binary') {
					ret = buf;
				}
				FS.close(stream);
				return ret;
			},
			writeFile: (path, data, opts = {}) => {
				opts.flags = opts.flags || 577;
				var stream = FS.open(path, opts.flags, opts.mode);
				if (typeof data == 'string') {
					var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
					var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
					FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
				} else if (ArrayBuffer.isView(data)) {
					FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
				} else {
					throw new Error('Unsupported data type');
				}
				FS.close(stream);
			},
			cwd: () => FS.currentPath,
			chdir: (path) => {
				var lookup = FS.lookupPath(path, { follow: true });
				if (lookup.node === null) {
					throw new FS.ErrnoError(44);
				}
				if (!FS.isDir(lookup.node.mode)) {
					throw new FS.ErrnoError(54);
				}
				var errCode = FS.nodePermissions(lookup.node, 'x');
				if (errCode) {
					throw new FS.ErrnoError(errCode);
				}
				FS.currentPath = lookup.path;
			},
			createDefaultDirectories: () => {
				FS.mkdir('/tmp');
				FS.mkdir('/home');
				FS.mkdir('/home/web_user');
			},
			createDefaultDevices: () => {
				FS.mkdir('/dev');
				FS.registerDevice(FS.makedev(1, 3), {
					read: () => 0,
					write: (stream, buffer, offset, length, pos) => length
				});
				FS.mkdev('/dev/null', FS.makedev(1, 3));
				TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
				TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
				FS.mkdev('/dev/tty', FS.makedev(5, 0));
				FS.mkdev('/dev/tty1', FS.makedev(6, 0));
				var random_device = getRandomDevice();
				FS.createDevice('/dev', 'random', random_device);
				FS.createDevice('/dev', 'urandom', random_device);
				FS.mkdir('/dev/shm');
				FS.mkdir('/dev/shm/tmp');
			},
			createSpecialDirectories: () => {
				FS.mkdir('/proc');
				var proc_self = FS.mkdir('/proc/self');
				FS.mkdir('/proc/self/fd');
				FS.mount(
					{
						mount: () => {
							var node = FS.createNode(proc_self, 'fd', 16384 | 511, 73);
							node.node_ops = {
								lookup: (parent, name) => {
									var fd = +name;
									var stream = FS.getStream(fd);
									if (!stream) throw new FS.ErrnoError(8);
									var ret = {
										parent: null,
										mount: { mountpoint: 'fake' },
										node_ops: { readlink: () => stream.path }
									};
									ret.parent = ret;
									return ret;
								}
							};
							return node;
						}
					},
					{},
					'/proc/self/fd'
				);
			},
			createStandardStreams: () => {
				if (Module['stdin']) {
					FS.createDevice('/dev', 'stdin', Module['stdin']);
				} else {
					FS.symlink('/dev/tty', '/dev/stdin');
				}
				if (Module['stdout']) {
					FS.createDevice('/dev', 'stdout', null, Module['stdout']);
				} else {
					FS.symlink('/dev/tty', '/dev/stdout');
				}
				if (Module['stderr']) {
					FS.createDevice('/dev', 'stderr', null, Module['stderr']);
				} else {
					FS.symlink('/dev/tty1', '/dev/stderr');
				}
				var stdin = FS.open('/dev/stdin', 0);
				var stdout = FS.open('/dev/stdout', 1);
				var stderr = FS.open('/dev/stderr', 1);
			},
			ensureErrnoError: () => {
				if (FS.ErrnoError) return;
				FS.ErrnoError = function ErrnoError(errno, node) {
					this.node = node;
					this.setErrno = function (errno) {
						this.errno = errno;
					};
					this.setErrno(errno);
					this.message = 'FS error';
				};
				FS.ErrnoError.prototype = new Error();
				FS.ErrnoError.prototype.constructor = FS.ErrnoError;
				[44].forEach((code) => {
					FS.genericErrors[code] = new FS.ErrnoError(code);
					FS.genericErrors[code].stack = '<generic error, no stack>';
				});
			},
			staticInit: () => {
				FS.ensureErrnoError();
				FS.nameTable = new Array(4096);
				FS.mount(MEMFS, {}, '/');
				FS.createDefaultDirectories();
				FS.createDefaultDevices();
				FS.createSpecialDirectories();
				FS.filesystems = { MEMFS: MEMFS, IDBFS: IDBFS, WORKERFS: WORKERFS, PROXYFS: PROXYFS };
			},
			init: (input, output, error) => {
				FS.init.initialized = true;
				FS.ensureErrnoError();
				Module['stdin'] = input || Module['stdin'];
				Module['stdout'] = output || Module['stdout'];
				Module['stderr'] = error || Module['stderr'];
				FS.createStandardStreams();
			},
			quit: () => {
				FS.init.initialized = false;
				for (var i = 0; i < FS.streams.length; i++) {
					var stream = FS.streams[i];
					if (!stream) {
						continue;
					}
					FS.close(stream);
				}
			},
			getMode: (canRead, canWrite) => {
				var mode = 0;
				if (canRead) mode |= 292 | 73;
				if (canWrite) mode |= 146;
				return mode;
			},
			findObject: (path, dontResolveLastLink) => {
				var ret = FS.analyzePath(path, dontResolveLastLink);
				if (ret.exists) {
					return ret.object;
				} else {
					return null;
				}
			},
			analyzePath: (path, dontResolveLastLink) => {
				try {
					var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
					path = lookup.path;
				} catch (e) {}
				var ret = {
					isRoot: false,
					exists: false,
					error: 0,
					name: null,
					path: null,
					object: null,
					parentExists: false,
					parentPath: null,
					parentObject: null
				};
				try {
					var lookup = FS.lookupPath(path, { parent: true });
					ret.parentExists = true;
					ret.parentPath = lookup.path;
					ret.parentObject = lookup.node;
					ret.name = PATH.basename(path);
					lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
					ret.exists = true;
					ret.path = lookup.path;
					ret.object = lookup.node;
					ret.name = lookup.node.name;
					ret.isRoot = lookup.path === '/';
				} catch (e) {
					ret.error = e.errno;
				}
				return ret;
			},
			createPath: (parent, path, canRead, canWrite) => {
				parent = typeof parent == 'string' ? parent : FS.getPath(parent);
				var parts = path.split('/').reverse();
				while (parts.length) {
					var part = parts.pop();
					if (!part) continue;
					var current = PATH.join2(parent, part);
					try {
						FS.mkdir(current);
					} catch (e) {}
					parent = current;
				}
				return current;
			},
			createFile: (parent, name, properties, canRead, canWrite) => {
				var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
				var mode = FS.getMode(canRead, canWrite);
				return FS.create(path, mode);
			},
			createDataFile: (parent, name, data, canRead, canWrite, canOwn) => {
				var path = name;
				if (parent) {
					parent = typeof parent == 'string' ? parent : FS.getPath(parent);
					path = name ? PATH.join2(parent, name) : parent;
				}
				var mode = FS.getMode(canRead, canWrite);
				var node = FS.create(path, mode);
				if (data) {
					if (typeof data == 'string') {
						var arr = new Array(data.length);
						for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
						data = arr;
					}
					FS.chmod(node, mode | 146);
					var stream = FS.open(node, 577);
					FS.write(stream, data, 0, data.length, 0, canOwn);
					FS.close(stream);
					FS.chmod(node, mode);
				}
				return node;
			},
			createDevice: (parent, name, input, output) => {
				var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
				var mode = FS.getMode(!!input, !!output);
				if (!FS.createDevice.major) FS.createDevice.major = 64;
				var dev = FS.makedev(FS.createDevice.major++, 0);
				FS.registerDevice(dev, {
					open: (stream) => {
						stream.seekable = false;
					},
					close: (stream) => {
						if (output && output.buffer && output.buffer.length) {
							output(10);
						}
					},
					read: (stream, buffer, offset, length, pos) => {
						var bytesRead = 0;
						for (var i = 0; i < length; i++) {
							var result;
							try {
								result = input();
							} catch (e) {
								throw new FS.ErrnoError(29);
							}
							if (result === undefined && bytesRead === 0) {
								throw new FS.ErrnoError(6);
							}
							if (result === null || result === undefined) break;
							bytesRead++;
							buffer[offset + i] = result;
						}
						if (bytesRead) {
							stream.node.timestamp = Date.now();
						}
						return bytesRead;
					},
					write: (stream, buffer, offset, length, pos) => {
						for (var i = 0; i < length; i++) {
							try {
								output(buffer[offset + i]);
							} catch (e) {
								throw new FS.ErrnoError(29);
							}
						}
						if (length) {
							stream.node.timestamp = Date.now();
						}
						return i;
					}
				});
				return FS.mkdev(path, mode, dev);
			},
			forceLoadFile: (obj) => {
				if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
				if (typeof XMLHttpRequest != 'undefined') {
					throw new Error(
						'Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.'
					);
				} else if (read_) {
					try {
						obj.contents = intArrayFromString(read_(obj.url), true);
						obj.usedBytes = obj.contents.length;
					} catch (e) {
						throw new FS.ErrnoError(29);
					}
				} else {
					throw new Error('Cannot load without read() or XMLHttpRequest.');
				}
			},
			createLazyFile: (parent, name, url, canRead, canWrite) => {
				function LazyUint8Array() {
					this.lengthKnown = false;
					this.chunks = [];
				}
				LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
					if (idx > this.length - 1 || idx < 0) {
						return undefined;
					}
					var chunkOffset = idx % this.chunkSize;
					var chunkNum = (idx / this.chunkSize) | 0;
					return this.getter(chunkNum)[chunkOffset];
				};
				LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
					this.getter = getter;
				};
				LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
					var xhr = new XMLHttpRequest();
					xhr.open('HEAD', url, false);
					xhr.send(null);
					if (!((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304))
						throw new Error("Couldn't load " + url + '. Status: ' + xhr.status);
					var datalength = Number(xhr.getResponseHeader('Content-length'));
					var header;
					var hasByteServing =
						(header = xhr.getResponseHeader('Accept-Ranges')) && header === 'bytes';
					var usesGzip = (header = xhr.getResponseHeader('Content-Encoding')) && header === 'gzip';
					var chunkSize = 1024 * 1024;
					if (!hasByteServing) chunkSize = datalength;
					var doXHR = (from, to) => {
						if (from > to)
							throw new Error('invalid range (' + from + ', ' + to + ') or no bytes requested!');
						if (to > datalength - 1)
							throw new Error('only ' + datalength + ' bytes available! programmer error!');
						var xhr = new XMLHttpRequest();
						xhr.open('GET', url, false);
						if (datalength !== chunkSize) xhr.setRequestHeader('Range', 'bytes=' + from + '-' + to);
						xhr.responseType = 'arraybuffer';
						if (xhr.overrideMimeType) {
							xhr.overrideMimeType('text/plain; charset=x-user-defined');
						}
						xhr.send(null);
						if (!((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304))
							throw new Error("Couldn't load " + url + '. Status: ' + xhr.status);
						if (xhr.response !== undefined) {
							return new Uint8Array(xhr.response || []);
						} else {
							return intArrayFromString(xhr.responseText || '', true);
						}
					};
					var lazyArray = this;
					lazyArray.setDataGetter((chunkNum) => {
						var start = chunkNum * chunkSize;
						var end = (chunkNum + 1) * chunkSize - 1;
						end = Math.min(end, datalength - 1);
						if (typeof lazyArray.chunks[chunkNum] == 'undefined') {
							lazyArray.chunks[chunkNum] = doXHR(start, end);
						}
						if (typeof lazyArray.chunks[chunkNum] == 'undefined') throw new Error('doXHR failed!');
						return lazyArray.chunks[chunkNum];
					});
					if (usesGzip || !datalength) {
						chunkSize = datalength = 1;
						datalength = this.getter(0).length;
						chunkSize = datalength;
						out('LazyFiles on gzip forces download of the whole file when length is accessed');
					}
					this._length = datalength;
					this._chunkSize = chunkSize;
					this.lengthKnown = true;
				};
				if (typeof XMLHttpRequest != 'undefined') {
					if (!ENVIRONMENT_IS_WORKER)
						throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
					var lazyArray = new LazyUint8Array();
					Object.defineProperties(lazyArray, {
						length: {
							get: function () {
								if (!this.lengthKnown) {
									this.cacheLength();
								}
								return this._length;
							}
						},
						chunkSize: {
							get: function () {
								if (!this.lengthKnown) {
									this.cacheLength();
								}
								return this._chunkSize;
							}
						}
					});
					var properties = { isDevice: false, contents: lazyArray };
				} else {
					var properties = { isDevice: false, url: url };
				}
				var node = FS.createFile(parent, name, properties, canRead, canWrite);
				if (properties.contents) {
					node.contents = properties.contents;
				} else if (properties.url) {
					node.contents = null;
					node.url = properties.url;
				}
				Object.defineProperties(node, {
					usedBytes: {
						get: function () {
							return this.contents.length;
						}
					}
				});
				var stream_ops = {};
				var keys = Object.keys(node.stream_ops);
				keys.forEach((key) => {
					var fn = node.stream_ops[key];
					stream_ops[key] = function forceLoadLazyFile() {
						FS.forceLoadFile(node);
						return fn.apply(null, arguments);
					};
				});
				stream_ops.read = (stream, buffer, offset, length, position) => {
					FS.forceLoadFile(node);
					var contents = stream.node.contents;
					if (position >= contents.length) return 0;
					var size = Math.min(contents.length - position, length);
					if (contents.slice) {
						for (var i = 0; i < size; i++) {
							buffer[offset + i] = contents[position + i];
						}
					} else {
						for (var i = 0; i < size; i++) {
							buffer[offset + i] = contents.get(position + i);
						}
					}
					return size;
				};
				node.stream_ops = stream_ops;
				return node;
			},
			createPreloadedFile: (
				parent,
				name,
				url,
				canRead,
				canWrite,
				onload,
				onerror,
				dontCreateFile,
				canOwn,
				preFinish
			) => {
				var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
				var dep = getUniqueRunDependency('cp ' + fullname);
				function processData(byteArray) {
					function finish(byteArray) {
						if (preFinish) preFinish();
						if (!dontCreateFile) {
							FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
						}
						if (onload) onload();
						removeRunDependency(dep);
					}
					if (
						Browser.handledByPreloadPlugin(byteArray, fullname, finish, () => {
							if (onerror) onerror();
							removeRunDependency(dep);
						})
					) {
						return;
					}
					finish(byteArray);
				}
				addRunDependency(dep);
				if (typeof url == 'string') {
					asyncLoad(url, (byteArray) => processData(byteArray), onerror);
				} else {
					processData(url);
				}
			},
			indexedDB: () => {
				return (
					window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
				);
			},
			DB_NAME: () => {
				return 'EM_FS_' + window.location.pathname;
			},
			DB_VERSION: 20,
			DB_STORE_NAME: 'FILE_DATA',
			saveFilesToDB: (paths, onload, onerror) => {
				onload = onload || (() => {});
				onerror = onerror || (() => {});
				var indexedDB = FS.indexedDB();
				try {
					var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
				} catch (e) {
					return onerror(e);
				}
				openRequest.onupgradeneeded = () => {
					out('creating db');
					var db = openRequest.result;
					db.createObjectStore(FS.DB_STORE_NAME);
				};
				openRequest.onsuccess = () => {
					var db = openRequest.result;
					var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
					var files = transaction.objectStore(FS.DB_STORE_NAME);
					var ok = 0,
						fail = 0,
						total = paths.length;
					function finish() {
						if (fail == 0) onload();
						else onerror();
					}
					paths.forEach((path) => {
						var putRequest = files.put(FS.analyzePath(path).object.contents, path);
						putRequest.onsuccess = () => {
							ok++;
							if (ok + fail == total) finish();
						};
						putRequest.onerror = () => {
							fail++;
							if (ok + fail == total) finish();
						};
					});
					transaction.onerror = onerror;
				};
				openRequest.onerror = onerror;
			},
			loadFilesFromDB: (paths, onload, onerror) => {
				onload = onload || (() => {});
				onerror = onerror || (() => {});
				var indexedDB = FS.indexedDB();
				try {
					var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
				} catch (e) {
					return onerror(e);
				}
				openRequest.onupgradeneeded = onerror;
				openRequest.onsuccess = () => {
					var db = openRequest.result;
					try {
						var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
					} catch (e) {
						onerror(e);
						return;
					}
					var files = transaction.objectStore(FS.DB_STORE_NAME);
					var ok = 0,
						fail = 0,
						total = paths.length;
					function finish() {
						if (fail == 0) onload();
						else onerror();
					}
					paths.forEach((path) => {
						var getRequest = files.get(path);
						getRequest.onsuccess = () => {
							if (FS.analyzePath(path).exists) {
								FS.unlink(path);
							}
							FS.createDataFile(
								PATH.dirname(path),
								PATH.basename(path),
								getRequest.result,
								true,
								true,
								true
							);
							ok++;
							if (ok + fail == total) finish();
						};
						getRequest.onerror = () => {
							fail++;
							if (ok + fail == total) finish();
						};
					});
					transaction.onerror = onerror;
				};
				openRequest.onerror = onerror;
			}
		};
		var SYSCALLS = {
			DEFAULT_POLLMASK: 5,
			calculateAt: function (dirfd, path, allowEmpty) {
				if (PATH.isAbs(path)) {
					return path;
				}
				var dir;
				if (dirfd === -100) {
					dir = FS.cwd();
				} else {
					var dirstream = FS.getStream(dirfd);
					if (!dirstream) throw new FS.ErrnoError(8);
					dir = dirstream.path;
				}
				if (path.length == 0) {
					if (!allowEmpty) {
						throw new FS.ErrnoError(44);
					}
					return dir;
				}
				return PATH.join2(dir, path);
			},
			doStat: function (func, path, buf) {
				try {
					var stat = func(path);
				} catch (e) {
					if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
						return -54;
					}
					throw e;
				}
				HEAP32[buf >> 2] = stat.dev;
				HEAP32[(buf + 4) >> 2] = 0;
				HEAP32[(buf + 8) >> 2] = stat.ino;
				HEAP32[(buf + 12) >> 2] = stat.mode;
				HEAP32[(buf + 16) >> 2] = stat.nlink;
				HEAP32[(buf + 20) >> 2] = stat.uid;
				HEAP32[(buf + 24) >> 2] = stat.gid;
				HEAP32[(buf + 28) >> 2] = stat.rdev;
				HEAP32[(buf + 32) >> 2] = 0;
				(tempI64 = [
					stat.size >>> 0,
					((tempDouble = stat.size),
					+Math.abs(tempDouble) >= 1
						? tempDouble > 0
							? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0
							: ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
						: 0)
				]),
					(HEAP32[(buf + 40) >> 2] = tempI64[0]),
					(HEAP32[(buf + 44) >> 2] = tempI64[1]);
				HEAP32[(buf + 48) >> 2] = 4096;
				HEAP32[(buf + 52) >> 2] = stat.blocks;
				HEAP32[(buf + 56) >> 2] = (stat.atime.getTime() / 1e3) | 0;
				HEAP32[(buf + 60) >> 2] = 0;
				HEAP32[(buf + 64) >> 2] = (stat.mtime.getTime() / 1e3) | 0;
				HEAP32[(buf + 68) >> 2] = 0;
				HEAP32[(buf + 72) >> 2] = (stat.ctime.getTime() / 1e3) | 0;
				HEAP32[(buf + 76) >> 2] = 0;
				(tempI64 = [
					stat.ino >>> 0,
					((tempDouble = stat.ino),
					+Math.abs(tempDouble) >= 1
						? tempDouble > 0
							? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0
							: ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
						: 0)
				]),
					(HEAP32[(buf + 80) >> 2] = tempI64[0]),
					(HEAP32[(buf + 84) >> 2] = tempI64[1]);
				return 0;
			},
			doMsync: function (addr, stream, len, flags, offset) {
				var buffer = HEAPU8.slice(addr, addr + len);
				FS.msync(stream, buffer, offset, len, flags);
			},
			doMknod: function (path, mode, dev) {
				switch (mode & 61440) {
					case 32768:
					case 8192:
					case 24576:
					case 4096:
					case 49152:
						break;
					default:
						return -28;
				}
				FS.mknod(path, mode, dev);
				return 0;
			},
			doReadlink: function (path, buf, bufsize) {
				if (bufsize <= 0) return -28;
				var ret = FS.readlink(path);
				var len = Math.min(bufsize, lengthBytesUTF8(ret));
				var endChar = HEAP8[buf + len];
				stringToUTF8(ret, buf, bufsize + 1);
				HEAP8[buf + len] = endChar;
				return len;
			},
			doAccess: function (path, amode) {
				if (amode & ~7) {
					return -28;
				}
				var lookup = FS.lookupPath(path, { follow: true });
				var node = lookup.node;
				if (!node) {
					return -44;
				}
				var perms = '';
				if (amode & 4) perms += 'r';
				if (amode & 2) perms += 'w';
				if (amode & 1) perms += 'x';
				if (perms && FS.nodePermissions(node, perms)) {
					return -2;
				}
				return 0;
			},
			doReadv: function (stream, iov, iovcnt, offset) {
				var ret = 0;
				for (var i = 0; i < iovcnt; i++) {
					var ptr = HEAP32[iov >> 2];
					var len = HEAP32[(iov + 4) >> 2];
					iov += 8;
					var curr = FS.read(stream, HEAP8, ptr, len, offset);
					if (curr < 0) return -1;
					ret += curr;
					if (curr < len) break;
				}
				return ret;
			},
			doWritev: function (stream, iov, iovcnt, offset) {
				var ret = 0;
				for (var i = 0; i < iovcnt; i++) {
					var ptr = HEAP32[iov >> 2];
					var len = HEAP32[(iov + 4) >> 2];
					iov += 8;
					var curr = FS.write(stream, HEAP8, ptr, len, offset);
					if (curr < 0) return -1;
					ret += curr;
				}
				return ret;
			},
			varargs: undefined,
			get: function () {
				SYSCALLS.varargs += 4;
				var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2];
				return ret;
			},
			getStr: function (ptr) {
				var ret = UTF8ToString(ptr);
				return ret;
			},
			getStreamFromFD: function (fd) {
				var stream = FS.getStream(fd);
				if (!stream) throw new FS.ErrnoError(8);
				return stream;
			}
		};
		function ___syscall__newselect(nfds, readfds, writefds, exceptfds, timeout) {
			try {
				var total = 0;
				var srcReadLow = readfds ? HEAP32[readfds >> 2] : 0,
					srcReadHigh = readfds ? HEAP32[(readfds + 4) >> 2] : 0;
				var srcWriteLow = writefds ? HEAP32[writefds >> 2] : 0,
					srcWriteHigh = writefds ? HEAP32[(writefds + 4) >> 2] : 0;
				var srcExceptLow = exceptfds ? HEAP32[exceptfds >> 2] : 0,
					srcExceptHigh = exceptfds ? HEAP32[(exceptfds + 4) >> 2] : 0;
				var dstReadLow = 0,
					dstReadHigh = 0;
				var dstWriteLow = 0,
					dstWriteHigh = 0;
				var dstExceptLow = 0,
					dstExceptHigh = 0;
				var allLow =
					(readfds ? HEAP32[readfds >> 2] : 0) |
					(writefds ? HEAP32[writefds >> 2] : 0) |
					(exceptfds ? HEAP32[exceptfds >> 2] : 0);
				var allHigh =
					(readfds ? HEAP32[(readfds + 4) >> 2] : 0) |
					(writefds ? HEAP32[(writefds + 4) >> 2] : 0) |
					(exceptfds ? HEAP32[(exceptfds + 4) >> 2] : 0);
				var check = function (fd, low, high, val) {
					return fd < 32 ? low & val : high & val;
				};
				for (var fd = 0; fd < nfds; fd++) {
					var mask = 1 << fd % 32;
					if (!check(fd, allLow, allHigh, mask)) {
						continue;
					}
					var stream = FS.getStream(fd);
					if (!stream) throw new FS.ErrnoError(8);
					var flags = SYSCALLS.DEFAULT_POLLMASK;
					if (stream.stream_ops.poll) {
						flags = stream.stream_ops.poll(stream);
					}
					if (flags & 1 && check(fd, srcReadLow, srcReadHigh, mask)) {
						fd < 32 ? (dstReadLow = dstReadLow | mask) : (dstReadHigh = dstReadHigh | mask);
						total++;
					}
					if (flags & 4 && check(fd, srcWriteLow, srcWriteHigh, mask)) {
						fd < 32 ? (dstWriteLow = dstWriteLow | mask) : (dstWriteHigh = dstWriteHigh | mask);
						total++;
					}
					if (flags & 2 && check(fd, srcExceptLow, srcExceptHigh, mask)) {
						fd < 32 ? (dstExceptLow = dstExceptLow | mask) : (dstExceptHigh = dstExceptHigh | mask);
						total++;
					}
				}
				if (readfds) {
					HEAP32[readfds >> 2] = dstReadLow;
					HEAP32[(readfds + 4) >> 2] = dstReadHigh;
				}
				if (writefds) {
					HEAP32[writefds >> 2] = dstWriteLow;
					HEAP32[(writefds + 4) >> 2] = dstWriteHigh;
				}
				if (exceptfds) {
					HEAP32[exceptfds >> 2] = dstExceptLow;
					HEAP32[(exceptfds + 4) >> 2] = dstExceptHigh;
				}
				return total;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		var SOCKFS = {
			mount: function (mount) {
				Module['websocket'] =
					Module['websocket'] && 'object' === typeof Module['websocket'] ? Module['websocket'] : {};
				Module['websocket']._callbacks = {};
				Module['websocket']['on'] = function (event, callback) {
					if ('function' === typeof callback) {
						this._callbacks[event] = callback;
					}
					return this;
				};
				Module['websocket'].emit = function (event, param) {
					if ('function' === typeof this._callbacks[event]) {
						this._callbacks[event].call(this, param);
					}
				};
				return FS.createNode(null, '/', 16384 | 511, 0);
			},
			createSocket: function (family, type, protocol) {
				type &= ~526336;
				var streaming = type == 1;
				if (streaming && protocol && protocol != 6) {
					throw new FS.ErrnoError(66);
				}
				var sock = {
					family: family,
					type: type,
					protocol: protocol,
					server: null,
					error: null,
					peers: {},
					pending: [],
					recv_queue: [],
					sock_ops: SOCKFS.websocket_sock_ops
				};
				var name = SOCKFS.nextname();
				var node = FS.createNode(SOCKFS.root, name, 49152, 0);
				node.sock = sock;
				var stream = FS.createStream({
					path: name,
					node: node,
					flags: 2,
					seekable: false,
					stream_ops: SOCKFS.stream_ops
				});
				sock.stream = stream;
				return sock;
			},
			getSocket: function (fd) {
				var stream = FS.getStream(fd);
				if (!stream || !FS.isSocket(stream.node.mode)) {
					return null;
				}
				return stream.node.sock;
			},
			stream_ops: {
				poll: function (stream) {
					var sock = stream.node.sock;
					return sock.sock_ops.poll(sock);
				},
				ioctl: function (stream, request, varargs) {
					var sock = stream.node.sock;
					return sock.sock_ops.ioctl(sock, request, varargs);
				},
				read: function (stream, buffer, offset, length, position) {
					var sock = stream.node.sock;
					var msg = sock.sock_ops.recvmsg(sock, length);
					if (!msg) {
						return 0;
					}
					buffer.set(msg.buffer, offset);
					return msg.buffer.length;
				},
				write: function (stream, buffer, offset, length, position) {
					var sock = stream.node.sock;
					return sock.sock_ops.sendmsg(sock, buffer, offset, length);
				},
				close: function (stream) {
					var sock = stream.node.sock;
					sock.sock_ops.close(sock);
				}
			},
			nextname: function () {
				if (!SOCKFS.nextname.current) {
					SOCKFS.nextname.current = 0;
				}
				return 'socket[' + SOCKFS.nextname.current++ + ']';
			},
			websocket_sock_ops: {
				createPeer: function (sock, addr, port) {
					var ws;
					if (typeof addr == 'object') {
						ws = addr;
						addr = null;
						port = null;
					}
					if (ws) {
						if (ws._socket) {
							addr = ws._socket.remoteAddress;
							port = ws._socket.remotePort;
						} else {
							var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
							if (!result) {
								throw new Error('WebSocket URL must be in the format ws(s)://address:port');
							}
							addr = result[1];
							port = parseInt(result[2], 10);
						}
					} else {
						try {
							var runtimeConfig = Module['websocket'] && 'object' === typeof Module['websocket'];
							var url = 'ws:#'.replace('#', '//');
							if (runtimeConfig) {
								if ('string' === typeof Module['websocket']['url']) {
									url = Module['websocket']['url'];
								}
							}
							if (url === 'ws://' || url === 'wss://') {
								var parts = addr.split('/');
								url = url + parts[0] + ':' + port + '/' + parts.slice(1).join('/');
							}
							var subProtocols = 'binary';
							if (runtimeConfig) {
								if ('string' === typeof Module['websocket']['subprotocol']) {
									subProtocols = Module['websocket']['subprotocol'];
								}
							}
							var opts = undefined;
							if (subProtocols !== 'null') {
								subProtocols = subProtocols.replace(/^ +| +$/g, '').split(/ *, */);
								opts = ENVIRONMENT_IS_NODE ? { protocol: subProtocols.toString() } : subProtocols;
							}
							if (runtimeConfig && null === Module['websocket']['subprotocol']) {
								subProtocols = 'null';
								opts = undefined;
							}
							var WebSocketConstructor;
							{
								WebSocketConstructor = WebSocket;
							}
							ws = new WebSocketConstructor(url, opts);
							ws.binaryType = 'arraybuffer';
						} catch (e) {
							throw new FS.ErrnoError(23);
						}
					}
					var peer = { addr: addr, port: port, socket: ws, dgram_send_queue: [] };
					SOCKFS.websocket_sock_ops.addPeer(sock, peer);
					SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
					if (sock.type === 2 && typeof sock.sport != 'undefined') {
						peer.dgram_send_queue.push(
							new Uint8Array([
								255,
								255,
								255,
								255,
								'p'.charCodeAt(0),
								'o'.charCodeAt(0),
								'r'.charCodeAt(0),
								't'.charCodeAt(0),
								(sock.sport & 65280) >> 8,
								sock.sport & 255
							])
						);
					}
					return peer;
				},
				getPeer: function (sock, addr, port) {
					return sock.peers[addr + ':' + port];
				},
				addPeer: function (sock, peer) {
					sock.peers[peer.addr + ':' + peer.port] = peer;
				},
				removePeer: function (sock, peer) {
					delete sock.peers[peer.addr + ':' + peer.port];
				},
				handlePeerEvents: function (sock, peer) {
					var first = true;
					var handleOpen = function () {
						Module['websocket'].emit('open', sock.stream.fd);
						try {
							var queued = peer.dgram_send_queue.shift();
							while (queued) {
								peer.socket.send(queued);
								queued = peer.dgram_send_queue.shift();
							}
						} catch (e) {
							peer.socket.close();
						}
					};
					function handleMessage(data) {
						if (typeof data == 'string') {
							var encoder = new TextEncoder();
							data = encoder.encode(data);
						} else {
							assert(data.byteLength !== undefined);
							if (data.byteLength == 0) {
								return;
							} else {
								data = new Uint8Array(data);
							}
						}
						var wasfirst = first;
						first = false;
						if (
							wasfirst &&
							data.length === 10 &&
							data[0] === 255 &&
							data[1] === 255 &&
							data[2] === 255 &&
							data[3] === 255 &&
							data[4] === 'p'.charCodeAt(0) &&
							data[5] === 'o'.charCodeAt(0) &&
							data[6] === 'r'.charCodeAt(0) &&
							data[7] === 't'.charCodeAt(0)
						) {
							var newport = (data[8] << 8) | data[9];
							SOCKFS.websocket_sock_ops.removePeer(sock, peer);
							peer.port = newport;
							SOCKFS.websocket_sock_ops.addPeer(sock, peer);
							return;
						}
						sock.recv_queue.push({ addr: peer.addr, port: peer.port, data: data });
						Module['websocket'].emit('message', sock.stream.fd);
					}
					if (ENVIRONMENT_IS_NODE) {
						peer.socket.on('open', handleOpen);
						peer.socket.on('message', function (data, flags) {
							if (!flags.binary) {
								return;
							}
							handleMessage(new Uint8Array(data).buffer);
						});
						peer.socket.on('close', function () {
							Module['websocket'].emit('close', sock.stream.fd);
						});
						peer.socket.on('error', function (error) {
							sock.error = 14;
							Module['websocket'].emit('error', [
								sock.stream.fd,
								sock.error,
								'ECONNREFUSED: Connection refused'
							]);
						});
					} else {
						peer.socket.onopen = handleOpen;
						peer.socket.onclose = function () {
							Module['websocket'].emit('close', sock.stream.fd);
						};
						peer.socket.onmessage = function peer_socket_onmessage(event) {
							handleMessage(event.data);
						};
						peer.socket.onerror = function (error) {
							sock.error = 14;
							Module['websocket'].emit('error', [
								sock.stream.fd,
								sock.error,
								'ECONNREFUSED: Connection refused'
							]);
						};
					}
				},
				poll: function (sock) {
					if (sock.type === 1 && sock.server) {
						return sock.pending.length ? 64 | 1 : 0;
					}
					var mask = 0;
					var dest =
						sock.type === 1
							? SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport)
							: null;
					if (
						sock.recv_queue.length ||
						!dest ||
						(dest && dest.socket.readyState === dest.socket.CLOSING) ||
						(dest && dest.socket.readyState === dest.socket.CLOSED)
					) {
						mask |= 64 | 1;
					}
					if (!dest || (dest && dest.socket.readyState === dest.socket.OPEN)) {
						mask |= 4;
					}
					if (
						(dest && dest.socket.readyState === dest.socket.CLOSING) ||
						(dest && dest.socket.readyState === dest.socket.CLOSED)
					) {
						mask |= 16;
					}
					return mask;
				},
				ioctl: function (sock, request, arg) {
					switch (request) {
						case 21531:
							var bytes = 0;
							if (sock.recv_queue.length) {
								bytes = sock.recv_queue[0].data.length;
							}
							HEAP32[arg >> 2] = bytes;
							return 0;
						default:
							return 28;
					}
				},
				close: function (sock) {
					if (sock.server) {
						try {
							sock.server.close();
						} catch (e) {}
						sock.server = null;
					}
					var peers = Object.keys(sock.peers);
					for (var i = 0; i < peers.length; i++) {
						var peer = sock.peers[peers[i]];
						try {
							peer.socket.close();
						} catch (e) {}
						SOCKFS.websocket_sock_ops.removePeer(sock, peer);
					}
					return 0;
				},
				bind: function (sock, addr, port) {
					if (typeof sock.saddr != 'undefined' || typeof sock.sport != 'undefined') {
						throw new FS.ErrnoError(28);
					}
					sock.saddr = addr;
					sock.sport = port;
					if (sock.type === 2) {
						if (sock.server) {
							sock.server.close();
							sock.server = null;
						}
						try {
							sock.sock_ops.listen(sock, 0);
						} catch (e) {
							if (!(e instanceof FS.ErrnoError)) throw e;
							if (e.errno !== 138) throw e;
						}
					}
				},
				connect: function (sock, addr, port) {
					if (sock.server) {
						throw new FS.ErrnoError(138);
					}
					if (typeof sock.daddr != 'undefined' && typeof sock.dport != 'undefined') {
						var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
						if (dest) {
							if (dest.socket.readyState === dest.socket.CONNECTING) {
								throw new FS.ErrnoError(7);
							} else {
								throw new FS.ErrnoError(30);
							}
						}
					}
					var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
					sock.daddr = peer.addr;
					sock.dport = peer.port;
					throw new FS.ErrnoError(26);
				},
				listen: function (sock, backlog) {
					if (!ENVIRONMENT_IS_NODE) {
						throw new FS.ErrnoError(138);
					}
				},
				accept: function (listensock) {
					if (!listensock.server || !listensock.pending.length) {
						throw new FS.ErrnoError(28);
					}
					var newsock = listensock.pending.shift();
					newsock.stream.flags = listensock.stream.flags;
					return newsock;
				},
				getname: function (sock, peer) {
					var addr, port;
					if (peer) {
						if (sock.daddr === undefined || sock.dport === undefined) {
							throw new FS.ErrnoError(53);
						}
						addr = sock.daddr;
						port = sock.dport;
					} else {
						addr = sock.saddr || 0;
						port = sock.sport || 0;
					}
					return { addr: addr, port: port };
				},
				sendmsg: function (sock, buffer, offset, length, addr, port) {
					if (sock.type === 2) {
						if (addr === undefined || port === undefined) {
							addr = sock.daddr;
							port = sock.dport;
						}
						if (addr === undefined || port === undefined) {
							throw new FS.ErrnoError(17);
						}
					} else {
						addr = sock.daddr;
						port = sock.dport;
					}
					var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
					if (sock.type === 1) {
						if (
							!dest ||
							dest.socket.readyState === dest.socket.CLOSING ||
							dest.socket.readyState === dest.socket.CLOSED
						) {
							throw new FS.ErrnoError(53);
						} else if (dest.socket.readyState === dest.socket.CONNECTING) {
							throw new FS.ErrnoError(6);
						}
					}
					if (ArrayBuffer.isView(buffer)) {
						offset += buffer.byteOffset;
						buffer = buffer.buffer;
					}
					var data;
					data = buffer.slice(offset, offset + length);
					if (sock.type === 2) {
						if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
							if (
								!dest ||
								dest.socket.readyState === dest.socket.CLOSING ||
								dest.socket.readyState === dest.socket.CLOSED
							) {
								dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
							}
							dest.dgram_send_queue.push(data);
							return length;
						}
					}
					try {
						dest.socket.send(data);
						return length;
					} catch (e) {
						throw new FS.ErrnoError(28);
					}
				},
				recvmsg: function (sock, length) {
					if (sock.type === 1 && sock.server) {
						throw new FS.ErrnoError(53);
					}
					var queued = sock.recv_queue.shift();
					if (!queued) {
						if (sock.type === 1) {
							var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
							if (!dest) {
								throw new FS.ErrnoError(53);
							} else if (
								dest.socket.readyState === dest.socket.CLOSING ||
								dest.socket.readyState === dest.socket.CLOSED
							) {
								return null;
							} else {
								throw new FS.ErrnoError(6);
							}
						} else {
							throw new FS.ErrnoError(6);
						}
					}
					var queuedLength = queued.data.byteLength || queued.data.length;
					var queuedOffset = queued.data.byteOffset || 0;
					var queuedBuffer = queued.data.buffer || queued.data;
					var bytesRead = Math.min(length, queuedLength);
					var res = {
						buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
						addr: queued.addr,
						port: queued.port
					};
					if (sock.type === 1 && bytesRead < queuedLength) {
						var bytesRemaining = queuedLength - bytesRead;
						queued.data = new Uint8Array(queuedBuffer, queuedOffset + bytesRead, bytesRemaining);
						sock.recv_queue.unshift(queued);
					}
					return res;
				}
			}
		};
		function getSocketFromFD(fd) {
			var socket = SOCKFS.getSocket(fd);
			if (!socket) throw new FS.ErrnoError(8);
			return socket;
		}
		function inetPton4(str) {
			var b = str.split('.');
			for (var i = 0; i < 4; i++) {
				var tmp = Number(b[i]);
				if (isNaN(tmp)) return null;
				b[i] = tmp;
			}
			return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
		}
		function jstoi_q(str) {
			return parseInt(str);
		}
		function inetPton6(str) {
			var words;
			var w, offset, z;
			var valid6regx =
				/^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i;
			var parts = [];
			if (!valid6regx.test(str)) {
				return null;
			}
			if (str === '::') {
				return [0, 0, 0, 0, 0, 0, 0, 0];
			}
			if (str.startsWith('::')) {
				str = str.replace('::', 'Z:');
			} else {
				str = str.replace('::', ':Z:');
			}
			if (str.indexOf('.') > 0) {
				str = str.replace(new RegExp('[.]', 'g'), ':');
				words = str.split(':');
				words[words.length - 4] =
					jstoi_q(words[words.length - 4]) + jstoi_q(words[words.length - 3]) * 256;
				words[words.length - 3] =
					jstoi_q(words[words.length - 2]) + jstoi_q(words[words.length - 1]) * 256;
				words = words.slice(0, words.length - 2);
			} else {
				words = str.split(':');
			}
			offset = 0;
			z = 0;
			for (w = 0; w < words.length; w++) {
				if (typeof words[w] == 'string') {
					if (words[w] === 'Z') {
						for (z = 0; z < 8 - words.length + 1; z++) {
							parts[w + z] = 0;
						}
						offset = z - 1;
					} else {
						parts[w + offset] = _htons(parseInt(words[w], 16));
					}
				} else {
					parts[w + offset] = words[w];
				}
			}
			return [
				(parts[1] << 16) | parts[0],
				(parts[3] << 16) | parts[2],
				(parts[5] << 16) | parts[4],
				(parts[7] << 16) | parts[6]
			];
		}
		function writeSockaddr(sa, family, addr, port, addrlen) {
			switch (family) {
				case 2:
					addr = inetPton4(addr);
					zeroMemory(sa, 16);
					if (addrlen) {
						HEAP32[addrlen >> 2] = 16;
					}
					HEAP16[sa >> 1] = family;
					HEAP32[(sa + 4) >> 2] = addr;
					HEAP16[(sa + 2) >> 1] = _htons(port);
					break;
				case 10:
					addr = inetPton6(addr);
					zeroMemory(sa, 28);
					if (addrlen) {
						HEAP32[addrlen >> 2] = 28;
					}
					HEAP32[sa >> 2] = family;
					HEAP32[(sa + 8) >> 2] = addr[0];
					HEAP32[(sa + 12) >> 2] = addr[1];
					HEAP32[(sa + 16) >> 2] = addr[2];
					HEAP32[(sa + 20) >> 2] = addr[3];
					HEAP16[(sa + 2) >> 1] = _htons(port);
					break;
				default:
					return 5;
			}
			return 0;
		}
		var DNS = {
			address_map: { id: 1, addrs: {}, names: {} },
			lookup_name: function (name) {
				var res = inetPton4(name);
				if (res !== null) {
					return name;
				}
				res = inetPton6(name);
				if (res !== null) {
					return name;
				}
				var addr;
				if (DNS.address_map.addrs[name]) {
					addr = DNS.address_map.addrs[name];
				} else {
					var id = DNS.address_map.id++;
					assert(id < 65535, 'exceeded max address mappings of 65535');
					addr = '172.29.' + (id & 255) + '.' + (id & 65280);
					DNS.address_map.names[addr] = name;
					DNS.address_map.addrs[name] = addr;
				}
				return addr;
			},
			lookup_addr: function (addr) {
				if (DNS.address_map.names[addr]) {
					return DNS.address_map.names[addr];
				}
				return null;
			}
		};
		function ___syscall_accept4(fd, addr, addrlen, flags) {
			try {
				var sock = getSocketFromFD(fd);
				var newsock = sock.sock_ops.accept(sock);
				if (addr) {
					var errno = writeSockaddr(
						addr,
						newsock.family,
						DNS.lookup_name(newsock.daddr),
						newsock.dport,
						addrlen
					);
				}
				return newsock.stream.fd;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function inetNtop4(addr) {
			return (
				(addr & 255) +
				'.' +
				((addr >> 8) & 255) +
				'.' +
				((addr >> 16) & 255) +
				'.' +
				((addr >> 24) & 255)
			);
		}
		function inetNtop6(ints) {
			var str = '';
			var word = 0;
			var longest = 0;
			var lastzero = 0;
			var zstart = 0;
			var len = 0;
			var i = 0;
			var parts = [
				ints[0] & 65535,
				ints[0] >> 16,
				ints[1] & 65535,
				ints[1] >> 16,
				ints[2] & 65535,
				ints[2] >> 16,
				ints[3] & 65535,
				ints[3] >> 16
			];
			var hasipv4 = true;
			var v4part = '';
			for (i = 0; i < 5; i++) {
				if (parts[i] !== 0) {
					hasipv4 = false;
					break;
				}
			}
			if (hasipv4) {
				v4part = inetNtop4(parts[6] | (parts[7] << 16));
				if (parts[5] === -1) {
					str = '::ffff:';
					str += v4part;
					return str;
				}
				if (parts[5] === 0) {
					str = '::';
					if (v4part === '0.0.0.0') v4part = '';
					if (v4part === '0.0.0.1') v4part = '1';
					str += v4part;
					return str;
				}
			}
			for (word = 0; word < 8; word++) {
				if (parts[word] === 0) {
					if (word - lastzero > 1) {
						len = 0;
					}
					lastzero = word;
					len++;
				}
				if (len > longest) {
					longest = len;
					zstart = word - longest + 1;
				}
			}
			for (word = 0; word < 8; word++) {
				if (longest > 1) {
					if (parts[word] === 0 && word >= zstart && word < zstart + longest) {
						if (word === zstart) {
							str += ':';
							if (zstart === 0) str += ':';
						}
						continue;
					}
				}
				str += Number(_ntohs(parts[word] & 65535)).toString(16);
				str += word < 7 ? ':' : '';
			}
			return str;
		}
		function readSockaddr(sa, salen) {
			var family = HEAP16[sa >> 1];
			var port = _ntohs(HEAPU16[(sa + 2) >> 1]);
			var addr;
			switch (family) {
				case 2:
					if (salen !== 16) {
						return { errno: 28 };
					}
					addr = HEAP32[(sa + 4) >> 2];
					addr = inetNtop4(addr);
					break;
				case 10:
					if (salen !== 28) {
						return { errno: 28 };
					}
					addr = [
						HEAP32[(sa + 8) >> 2],
						HEAP32[(sa + 12) >> 2],
						HEAP32[(sa + 16) >> 2],
						HEAP32[(sa + 20) >> 2]
					];
					addr = inetNtop6(addr);
					break;
				default:
					return { errno: 5 };
			}
			return { family: family, addr: addr, port: port };
		}
		function getSocketAddress(addrp, addrlen, allowNull) {
			if (allowNull && addrp === 0) return null;
			var info = readSockaddr(addrp, addrlen);
			if (info.errno) throw new FS.ErrnoError(info.errno);
			info.addr = DNS.lookup_addr(info.addr) || info.addr;
			return info;
		}
		function ___syscall_bind(fd, addr, addrlen) {
			try {
				var sock = getSocketFromFD(fd);
				var info = getSocketAddress(addr, addrlen);
				sock.sock_ops.bind(sock, info.addr, info.port);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_chdir(path) {
			try {
				path = SYSCALLS.getStr(path);
				FS.chdir(path);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_chmod(path, mode) {
			try {
				path = SYSCALLS.getStr(path);
				FS.chmod(path, mode);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_connect(fd, addr, addrlen) {
			try {
				var sock = getSocketFromFD(fd);
				var info = getSocketAddress(addr, addrlen);
				sock.sock_ops.connect(sock, info.addr, info.port);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_dup3(fd, suggestFD, flags) {
			try {
				var old = SYSCALLS.getStreamFromFD(fd);
				if (old.fd === suggestFD) return -28;
				var suggest = FS.getStream(suggestFD);
				if (suggest) FS.close(suggest);
				return FS.createStream(old, suggestFD, suggestFD + 1).fd;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_faccessat(dirfd, path, amode, flags) {
			try {
				path = SYSCALLS.getStr(path);
				path = SYSCALLS.calculateAt(dirfd, path);
				return SYSCALLS.doAccess(path, amode);
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_fadvise64(fd, offset, len, advice) {
			return 0;
		}
		function ___syscall_fchdir(fd) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				FS.chdir(stream.path);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_fchmod(fd, mode) {
			try {
				FS.fchmod(fd, mode);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_fchmodat(dirfd, path, mode, varargs) {
			SYSCALLS.varargs = varargs;
			try {
				path = SYSCALLS.getStr(path);
				path = SYSCALLS.calculateAt(dirfd, path);
				FS.chmod(path, mode);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_fchown32(fd, owner, group) {
			try {
				FS.fchown(fd, owner, group);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_fchownat(dirfd, path, owner, group, flags) {
			try {
				path = SYSCALLS.getStr(path);
				var nofollow = flags & 256;
				flags = flags & ~256;
				path = SYSCALLS.calculateAt(dirfd, path);
				(nofollow ? FS.lchown : FS.chown)(path, owner, group);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_fcntl64(fd, cmd, varargs) {
			SYSCALLS.varargs = varargs;
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				switch (cmd) {
					case 0: {
						var arg = SYSCALLS.get();
						if (arg < 0) {
							return -28;
						}
						var newStream;
						newStream = FS.createStream(stream, arg);
						return newStream.fd;
					}
					case 1:
					case 2:
						return 0;
					case 3:
						return stream.flags;
					case 4: {
						var arg = SYSCALLS.get();
						stream.flags |= arg;
						return 0;
					}
					case 5: {
						var arg = SYSCALLS.get();
						var offset = 0;
						HEAP16[(arg + offset) >> 1] = 2;
						return 0;
					}
					case 6:
					case 7:
						return 0;
					case 16:
					case 8:
						return -28;
					case 9:
						setErrNo(28);
						return -1;
					default: {
						return -28;
					}
				}
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_fdatasync(fd) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_fstat64(fd, buf) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				return SYSCALLS.doStat(FS.stat, stream.path, buf);
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_statfs64(path, size, buf) {
			try {
				path = SYSCALLS.getStr(path);
				HEAP32[(buf + 4) >> 2] = 4096;
				HEAP32[(buf + 40) >> 2] = 4096;
				HEAP32[(buf + 8) >> 2] = 1e6;
				HEAP32[(buf + 12) >> 2] = 5e5;
				HEAP32[(buf + 16) >> 2] = 5e5;
				HEAP32[(buf + 20) >> 2] = FS.nextInode;
				HEAP32[(buf + 24) >> 2] = 1e6;
				HEAP32[(buf + 28) >> 2] = 42;
				HEAP32[(buf + 44) >> 2] = 2;
				HEAP32[(buf + 36) >> 2] = 255;
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_fstatfs64(fd, size, buf) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				return ___syscall_statfs64(0, size, buf);
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_ftruncate64(fd, length_low, length_high) {
			try {
				var length = length_high * 4294967296 + (length_low >>> 0);
				FS.ftruncate(fd, length);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_getcwd(buf, size) {
			try {
				if (size === 0) return -28;
				var cwd = FS.cwd();
				var cwdLengthInBytes = lengthBytesUTF8(cwd) + 1;
				if (size < cwdLengthInBytes) return -68;
				stringToUTF8(cwd, buf, size);
				return cwdLengthInBytes;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_getdents64(fd, dirp, count) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				if (!stream.getdents) {
					stream.getdents = FS.readdir(stream.path);
				}
				var struct_size = 280;
				var pos = 0;
				var off = FS.llseek(stream, 0, 1);
				var idx = Math.floor(off / struct_size);
				while (idx < stream.getdents.length && pos + struct_size <= count) {
					var id;
					var type;
					var name = stream.getdents[idx];
					if (name === '.') {
						id = stream.node.id;
						type = 4;
					} else if (name === '..') {
						var lookup = FS.lookupPath(stream.path, { parent: true });
						id = lookup.node.id;
						type = 4;
					} else {
						var child = FS.lookupNode(stream.node, name);
						id = child.id;
						type = FS.isChrdev(child.mode)
							? 2
							: FS.isDir(child.mode)
							? 4
							: FS.isLink(child.mode)
							? 10
							: 8;
					}
					(tempI64 = [
						id >>> 0,
						((tempDouble = id),
						+Math.abs(tempDouble) >= 1
							? tempDouble > 0
								? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0
								: ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
							: 0)
					]),
						(HEAP32[(dirp + pos) >> 2] = tempI64[0]),
						(HEAP32[(dirp + pos + 4) >> 2] = tempI64[1]);
					(tempI64 = [
						((idx + 1) * struct_size) >>> 0,
						((tempDouble = (idx + 1) * struct_size),
						+Math.abs(tempDouble) >= 1
							? tempDouble > 0
								? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0
								: ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
							: 0)
					]),
						(HEAP32[(dirp + pos + 8) >> 2] = tempI64[0]),
						(HEAP32[(dirp + pos + 12) >> 2] = tempI64[1]);
					HEAP16[(dirp + pos + 16) >> 1] = 280;
					HEAP8[(dirp + pos + 18) >> 0] = type;
					stringToUTF8(name, dirp + pos + 19, 256);
					pos += struct_size;
					idx += 1;
				}
				FS.llseek(stream, idx * struct_size, 0);
				return pos;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_getpeername(fd, addr, addrlen) {
			try {
				var sock = getSocketFromFD(fd);
				if (!sock.daddr) {
					return -53;
				}
				var errno = writeSockaddr(
					addr,
					sock.family,
					DNS.lookup_name(sock.daddr),
					sock.dport,
					addrlen
				);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_getsockname(fd, addr, addrlen) {
			try {
				err('__syscall_getsockname ' + fd);
				var sock = getSocketFromFD(fd);
				var errno = writeSockaddr(
					addr,
					sock.family,
					DNS.lookup_name(sock.saddr || '0.0.0.0'),
					sock.sport,
					addrlen
				);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_getsockopt(fd, level, optname, optval, optlen) {
			try {
				var sock = getSocketFromFD(fd);
				if (level === 1) {
					if (optname === 4) {
						HEAP32[optval >> 2] = sock.error;
						HEAP32[optlen >> 2] = 4;
						sock.error = null;
						return 0;
					}
				}
				return -50;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_ioctl(fd, op, varargs) {
			SYSCALLS.varargs = varargs;
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				switch (op) {
					case 21509:
					case 21505: {
						if (!stream.tty) return -59;
						return 0;
					}
					case 21510:
					case 21511:
					case 21512:
					case 21506:
					case 21507:
					case 21508: {
						if (!stream.tty) return -59;
						return 0;
					}
					case 21519: {
						if (!stream.tty) return -59;
						var argp = SYSCALLS.get();
						HEAP32[argp >> 2] = 0;
						return 0;
					}
					case 21520: {
						if (!stream.tty) return -59;
						return -28;
					}
					case 21531: {
						var argp = SYSCALLS.get();
						return FS.ioctl(stream, op, argp);
					}
					case 21523: {
						if (!stream.tty) return -59;
						return 0;
					}
					case 21524: {
						if (!stream.tty) return -59;
						return 0;
					}
					default:
						abort('bad ioctl syscall ' + op);
				}
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_listen(fd, backlog) {
			try {
				var sock = getSocketFromFD(fd);
				sock.sock_ops.listen(sock, backlog);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_lstat64(path, buf) {
			try {
				path = SYSCALLS.getStr(path);
				return SYSCALLS.doStat(FS.lstat, path, buf);
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_mkdirat(dirfd, path, mode) {
			try {
				path = SYSCALLS.getStr(path);
				path = SYSCALLS.calculateAt(dirfd, path);
				path = PATH.normalize(path);
				if (path[path.length - 1] === '/') path = path.substr(0, path.length - 1);
				FS.mkdir(path, mode, 0);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_newfstatat(dirfd, path, buf, flags) {
			try {
				path = SYSCALLS.getStr(path);
				var nofollow = flags & 256;
				var allowEmpty = flags & 4096;
				flags = flags & ~4352;
				path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
				return SYSCALLS.doStat(nofollow ? FS.lstat : FS.stat, path, buf);
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_openat(dirfd, path, flags, varargs) {
			SYSCALLS.varargs = varargs;
			try {
				path = SYSCALLS.getStr(path);
				path = SYSCALLS.calculateAt(dirfd, path);
				var mode = varargs ? SYSCALLS.get() : 0;
				return FS.open(path, flags, mode).fd;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		var PIPEFS = {
			BUCKET_BUFFER_SIZE: 8192,
			mount: function (mount) {
				return FS.createNode(null, '/', 16384 | 511, 0);
			},
			createPipe: function () {
				var pipe = { buckets: [], refcnt: 2 };
				pipe.buckets.push({
					buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
					offset: 0,
					roffset: 0
				});
				var rName = PIPEFS.nextname();
				var wName = PIPEFS.nextname();
				var rNode = FS.createNode(PIPEFS.root, rName, 4096, 0);
				var wNode = FS.createNode(PIPEFS.root, wName, 4096, 0);
				rNode.pipe = pipe;
				wNode.pipe = pipe;
				var readableStream = FS.createStream({
					path: rName,
					node: rNode,
					flags: 0,
					seekable: false,
					stream_ops: PIPEFS.stream_ops
				});
				rNode.stream = readableStream;
				var writableStream = FS.createStream({
					path: wName,
					node: wNode,
					flags: 1,
					seekable: false,
					stream_ops: PIPEFS.stream_ops
				});
				wNode.stream = writableStream;
				return { readable_fd: readableStream.fd, writable_fd: writableStream.fd };
			},
			stream_ops: {
				poll: function (stream) {
					var pipe = stream.node.pipe;
					if ((stream.flags & 2097155) === 1) {
						return 256 | 4;
					} else {
						if (pipe.buckets.length > 0) {
							for (var i = 0; i < pipe.buckets.length; i++) {
								var bucket = pipe.buckets[i];
								if (bucket.offset - bucket.roffset > 0) {
									return 64 | 1;
								}
							}
						}
					}
					return 0;
				},
				ioctl: function (stream, request, varargs) {
					return 28;
				},
				fsync: function (stream) {
					return 28;
				},
				read: function (stream, buffer, offset, length, position) {
					var pipe = stream.node.pipe;
					var currentLength = 0;
					for (var i = 0; i < pipe.buckets.length; i++) {
						var bucket = pipe.buckets[i];
						currentLength += bucket.offset - bucket.roffset;
					}
					assert(buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer));
					var data = buffer.subarray(offset, offset + length);
					if (length <= 0) {
						return 0;
					}
					if (currentLength == 0) {
						throw new FS.ErrnoError(6);
					}
					var toRead = Math.min(currentLength, length);
					var totalRead = toRead;
					var toRemove = 0;
					for (var i = 0; i < pipe.buckets.length; i++) {
						var currBucket = pipe.buckets[i];
						var bucketSize = currBucket.offset - currBucket.roffset;
						if (toRead <= bucketSize) {
							var tmpSlice = currBucket.buffer.subarray(currBucket.roffset, currBucket.offset);
							if (toRead < bucketSize) {
								tmpSlice = tmpSlice.subarray(0, toRead);
								currBucket.roffset += toRead;
							} else {
								toRemove++;
							}
							data.set(tmpSlice);
							break;
						} else {
							var tmpSlice = currBucket.buffer.subarray(currBucket.roffset, currBucket.offset);
							data.set(tmpSlice);
							data = data.subarray(tmpSlice.byteLength);
							toRead -= tmpSlice.byteLength;
							toRemove++;
						}
					}
					if (toRemove && toRemove == pipe.buckets.length) {
						toRemove--;
						pipe.buckets[toRemove].offset = 0;
						pipe.buckets[toRemove].roffset = 0;
					}
					pipe.buckets.splice(0, toRemove);
					return totalRead;
				},
				write: function (stream, buffer, offset, length, position) {
					var pipe = stream.node.pipe;
					assert(buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer));
					var data = buffer.subarray(offset, offset + length);
					var dataLen = data.byteLength;
					if (dataLen <= 0) {
						return 0;
					}
					var currBucket = null;
					if (pipe.buckets.length == 0) {
						currBucket = {
							buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
							offset: 0,
							roffset: 0
						};
						pipe.buckets.push(currBucket);
					} else {
						currBucket = pipe.buckets[pipe.buckets.length - 1];
					}
					assert(currBucket.offset <= PIPEFS.BUCKET_BUFFER_SIZE);
					var freeBytesInCurrBuffer = PIPEFS.BUCKET_BUFFER_SIZE - currBucket.offset;
					if (freeBytesInCurrBuffer >= dataLen) {
						currBucket.buffer.set(data, currBucket.offset);
						currBucket.offset += dataLen;
						return dataLen;
					} else if (freeBytesInCurrBuffer > 0) {
						currBucket.buffer.set(data.subarray(0, freeBytesInCurrBuffer), currBucket.offset);
						currBucket.offset += freeBytesInCurrBuffer;
						data = data.subarray(freeBytesInCurrBuffer, data.byteLength);
					}
					var numBuckets = (data.byteLength / PIPEFS.BUCKET_BUFFER_SIZE) | 0;
					var remElements = data.byteLength % PIPEFS.BUCKET_BUFFER_SIZE;
					for (var i = 0; i < numBuckets; i++) {
						var newBucket = {
							buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
							offset: PIPEFS.BUCKET_BUFFER_SIZE,
							roffset: 0
						};
						pipe.buckets.push(newBucket);
						newBucket.buffer.set(data.subarray(0, PIPEFS.BUCKET_BUFFER_SIZE));
						data = data.subarray(PIPEFS.BUCKET_BUFFER_SIZE, data.byteLength);
					}
					if (remElements > 0) {
						var newBucket = {
							buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
							offset: data.byteLength,
							roffset: 0
						};
						pipe.buckets.push(newBucket);
						newBucket.buffer.set(data);
					}
					return dataLen;
				},
				close: function (stream) {
					var pipe = stream.node.pipe;
					pipe.refcnt--;
					if (pipe.refcnt === 0) {
						pipe.buckets = null;
					}
				}
			},
			nextname: function () {
				if (!PIPEFS.nextname.current) {
					PIPEFS.nextname.current = 0;
				}
				return 'pipe[' + PIPEFS.nextname.current++ + ']';
			}
		};
		function ___syscall_pipe(fdPtr) {
			try {
				if (fdPtr == 0) {
					throw new FS.ErrnoError(21);
				}
				var res = PIPEFS.createPipe();
				HEAP32[fdPtr >> 2] = res.readable_fd;
				HEAP32[(fdPtr + 4) >> 2] = res.writable_fd;
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_poll(fds, nfds, timeout) {
			try {
				var nonzero = 0;
				for (var i = 0; i < nfds; i++) {
					var pollfd = fds + 8 * i;
					var fd = HEAP32[pollfd >> 2];
					var events = HEAP16[(pollfd + 4) >> 1];
					var mask = 32;
					var stream = FS.getStream(fd);
					if (stream) {
						mask = SYSCALLS.DEFAULT_POLLMASK;
						if (stream.stream_ops.poll) {
							mask = stream.stream_ops.poll(stream);
						}
					}
					mask &= events | 8 | 16;
					if (mask) nonzero++;
					HEAP16[(pollfd + 6) >> 1] = mask;
				}
				return nonzero;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_readlinkat(dirfd, path, buf, bufsize) {
			try {
				path = SYSCALLS.getStr(path);
				path = SYSCALLS.calculateAt(dirfd, path);
				return SYSCALLS.doReadlink(path, buf, bufsize);
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_recvfrom(fd, buf, len, flags, addr, addrlen) {
			try {
				var sock = getSocketFromFD(fd);
				var msg = sock.sock_ops.recvmsg(sock, len);
				if (!msg) return 0;
				if (addr) {
					var errno = writeSockaddr(
						addr,
						sock.family,
						DNS.lookup_name(msg.addr),
						msg.port,
						addrlen
					);
				}
				HEAPU8.set(msg.buffer, buf);
				return msg.buffer.byteLength;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_recvmsg(fd, message, flags) {
			try {
				var sock = getSocketFromFD(fd);
				var iov = HEAP32[(message + 8) >> 2];
				var num = HEAP32[(message + 12) >> 2];
				var total = 0;
				for (var i = 0; i < num; i++) {
					total += HEAP32[(iov + (8 * i + 4)) >> 2];
				}
				var msg = sock.sock_ops.recvmsg(sock, total);
				if (!msg) return 0;
				var name = HEAP32[message >> 2];
				if (name) {
					var errno = writeSockaddr(name, sock.family, DNS.lookup_name(msg.addr), msg.port);
				}
				var bytesRead = 0;
				var bytesRemaining = msg.buffer.byteLength;
				for (var i = 0; bytesRemaining > 0 && i < num; i++) {
					var iovbase = HEAP32[(iov + (8 * i + 0)) >> 2];
					var iovlen = HEAP32[(iov + (8 * i + 4)) >> 2];
					if (!iovlen) {
						continue;
					}
					var length = Math.min(iovlen, bytesRemaining);
					var buf = msg.buffer.subarray(bytesRead, bytesRead + length);
					HEAPU8.set(buf, iovbase + bytesRead);
					bytesRead += length;
					bytesRemaining -= length;
				}
				return bytesRead;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_renameat(olddirfd, oldpath, newdirfd, newpath) {
			try {
				oldpath = SYSCALLS.getStr(oldpath);
				newpath = SYSCALLS.getStr(newpath);
				oldpath = SYSCALLS.calculateAt(olddirfd, oldpath);
				newpath = SYSCALLS.calculateAt(newdirfd, newpath);
				FS.rename(oldpath, newpath);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_rmdir(path) {
			try {
				path = SYSCALLS.getStr(path);
				FS.rmdir(path);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_sendmsg(fd, message, flags) {
			try {
				var sock = getSocketFromFD(fd);
				var iov = HEAP32[(message + 8) >> 2];
				var num = HEAP32[(message + 12) >> 2];
				var addr, port;
				var name = HEAP32[message >> 2];
				var namelen = HEAP32[(message + 4) >> 2];
				if (name) {
					var info = readSockaddr(name, namelen);
					if (info.errno) return -info.errno;
					port = info.port;
					addr = DNS.lookup_addr(info.addr) || info.addr;
				}
				var total = 0;
				for (var i = 0; i < num; i++) {
					total += HEAP32[(iov + (8 * i + 4)) >> 2];
				}
				var view = new Uint8Array(total);
				var offset = 0;
				for (var i = 0; i < num; i++) {
					var iovbase = HEAP32[(iov + (8 * i + 0)) >> 2];
					var iovlen = HEAP32[(iov + (8 * i + 4)) >> 2];
					for (var j = 0; j < iovlen; j++) {
						view[offset++] = HEAP8[(iovbase + j) >> 0];
					}
				}
				return sock.sock_ops.sendmsg(sock, view, 0, total, addr, port);
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_sendto(fd, message, length, flags, addr, addr_len) {
			try {
				var sock = getSocketFromFD(fd);
				var dest = getSocketAddress(addr, addr_len, true);
				if (!dest) {
					return FS.write(sock.stream, HEAP8, message, length);
				} else {
					return sock.sock_ops.sendmsg(sock, HEAP8, message, length, dest.addr, dest.port);
				}
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_socket(domain, type, protocol) {
			try {
				var sock = SOCKFS.createSocket(domain, type, protocol);
				return sock.stream.fd;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_stat64(path, buf) {
			try {
				path = SYSCALLS.getStr(path);
				return SYSCALLS.doStat(FS.stat, path, buf);
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_symlink(target, linkpath) {
			try {
				target = SYSCALLS.getStr(target);
				linkpath = SYSCALLS.getStr(linkpath);
				FS.symlink(target, linkpath);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_truncate64(path, length_low, length_high) {
			try {
				var length = length_high * 4294967296 + (length_low >>> 0);
				path = SYSCALLS.getStr(path);
				FS.truncate(path, length);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_unlinkat(dirfd, path, flags) {
			try {
				path = SYSCALLS.getStr(path);
				path = SYSCALLS.calculateAt(dirfd, path);
				if (flags === 0) {
					FS.unlink(path);
				} else if (flags === 512) {
					FS.rmdir(path);
				} else {
					abort('Invalid flags passed to unlinkat');
				}
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function ___syscall_utimensat(dirfd, path, times, flags) {
			try {
				path = SYSCALLS.getStr(path);
				path = SYSCALLS.calculateAt(dirfd, path, true);
				if (!times) {
					var atime = Date.now();
					var mtime = atime;
				} else {
					var seconds = HEAP32[times >> 2];
					var nanoseconds = HEAP32[(times + 4) >> 2];
					atime = seconds * 1e3 + nanoseconds / (1e3 * 1e3);
					times += 8;
					seconds = HEAP32[times >> 2];
					nanoseconds = HEAP32[(times + 4) >> 2];
					mtime = seconds * 1e3 + nanoseconds / (1e3 * 1e3);
				}
				FS.utime(path, atime, mtime);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function __emscripten_date_now() {
			return Date.now();
		}
		var nowIsMonotonic = true;
		function __emscripten_get_now_is_monotonic() {
			return nowIsMonotonic;
		}
		function __gmtime_js(time, tmPtr) {
			var date = new Date(HEAP32[time >> 2] * 1e3);
			HEAP32[tmPtr >> 2] = date.getUTCSeconds();
			HEAP32[(tmPtr + 4) >> 2] = date.getUTCMinutes();
			HEAP32[(tmPtr + 8) >> 2] = date.getUTCHours();
			HEAP32[(tmPtr + 12) >> 2] = date.getUTCDate();
			HEAP32[(tmPtr + 16) >> 2] = date.getUTCMonth();
			HEAP32[(tmPtr + 20) >> 2] = date.getUTCFullYear() - 1900;
			HEAP32[(tmPtr + 24) >> 2] = date.getUTCDay();
			var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
			var yday = ((date.getTime() - start) / (1e3 * 60 * 60 * 24)) | 0;
			HEAP32[(tmPtr + 28) >> 2] = yday;
		}
		function __localtime_js(time, tmPtr) {
			var date = new Date(HEAP32[time >> 2] * 1e3);
			HEAP32[tmPtr >> 2] = date.getSeconds();
			HEAP32[(tmPtr + 4) >> 2] = date.getMinutes();
			HEAP32[(tmPtr + 8) >> 2] = date.getHours();
			HEAP32[(tmPtr + 12) >> 2] = date.getDate();
			HEAP32[(tmPtr + 16) >> 2] = date.getMonth();
			HEAP32[(tmPtr + 20) >> 2] = date.getFullYear() - 1900;
			HEAP32[(tmPtr + 24) >> 2] = date.getDay();
			var start = new Date(date.getFullYear(), 0, 1);
			var yday = ((date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24)) | 0;
			HEAP32[(tmPtr + 28) >> 2] = yday;
			HEAP32[(tmPtr + 36) >> 2] = -(date.getTimezoneOffset() * 60);
			var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
			var winterOffset = start.getTimezoneOffset();
			var dst =
				(summerOffset != winterOffset &&
					date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
			HEAP32[(tmPtr + 32) >> 2] = dst;
		}
		function __mktime_js(tmPtr) {
			var date = new Date(
				HEAP32[(tmPtr + 20) >> 2] + 1900,
				HEAP32[(tmPtr + 16) >> 2],
				HEAP32[(tmPtr + 12) >> 2],
				HEAP32[(tmPtr + 8) >> 2],
				HEAP32[(tmPtr + 4) >> 2],
				HEAP32[tmPtr >> 2],
				0
			);
			var dst = HEAP32[(tmPtr + 32) >> 2];
			var guessedOffset = date.getTimezoneOffset();
			var start = new Date(date.getFullYear(), 0, 1);
			var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
			var winterOffset = start.getTimezoneOffset();
			var dstOffset = Math.min(winterOffset, summerOffset);
			if (dst < 0) {
				HEAP32[(tmPtr + 32) >> 2] = Number(
					summerOffset != winterOffset && dstOffset == guessedOffset
				);
			} else if (dst > 0 != (dstOffset == guessedOffset)) {
				var nonDstOffset = Math.max(winterOffset, summerOffset);
				var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
				date.setTime(date.getTime() + (trueOffset - guessedOffset) * 6e4);
			}
			HEAP32[(tmPtr + 24) >> 2] = date.getDay();
			var yday = ((date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24)) | 0;
			HEAP32[(tmPtr + 28) >> 2] = yday;
			HEAP32[tmPtr >> 2] = date.getSeconds();
			HEAP32[(tmPtr + 4) >> 2] = date.getMinutes();
			HEAP32[(tmPtr + 8) >> 2] = date.getHours();
			HEAP32[(tmPtr + 12) >> 2] = date.getDate();
			HEAP32[(tmPtr + 16) >> 2] = date.getMonth();
			return (date.getTime() / 1e3) | 0;
		}
		function __mmap_js(addr, len, prot, flags, fd, off, allocated, builtin) {
			try {
				var info = FS.getStream(fd);
				if (!info) return -8;
				var res = FS.mmap(info, addr, len, off, prot, flags);
				var ptr = res.ptr;
				HEAP32[allocated >> 2] = res.allocated;
				return ptr;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function __msync_js(addr, len, flags, fd) {
			try {
				SYSCALLS.doMsync(addr, FS.getStream(fd), len, flags, 0);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function __munmap_js(addr, len, prot, flags, fd, offset) {
			try {
				var stream = FS.getStream(fd);
				if (stream) {
					if (prot & 2) {
						SYSCALLS.doMsync(addr, stream, len, flags, offset);
					}
					FS.munmap(stream);
				}
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return -e.errno;
			}
		}
		function _tzset_impl(timezone, daylight, tzname) {
			var currentYear = new Date().getFullYear();
			var winter = new Date(currentYear, 0, 1);
			var summer = new Date(currentYear, 6, 1);
			var winterOffset = winter.getTimezoneOffset();
			var summerOffset = summer.getTimezoneOffset();
			var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
			HEAP32[timezone >> 2] = stdTimezoneOffset * 60;
			HEAP32[daylight >> 2] = Number(winterOffset != summerOffset);
			function extractZone(date) {
				var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);
				return match ? match[1] : 'GMT';
			}
			var winterName = extractZone(winter);
			var summerName = extractZone(summer);
			var winterNamePtr = allocateUTF8(winterName);
			var summerNamePtr = allocateUTF8(summerName);
			if (summerOffset < winterOffset) {
				HEAP32[tzname >> 2] = winterNamePtr;
				HEAP32[(tzname + 4) >> 2] = summerNamePtr;
			} else {
				HEAP32[tzname >> 2] = summerNamePtr;
				HEAP32[(tzname + 4) >> 2] = winterNamePtr;
			}
		}
		function __tzset_js(timezone, daylight, tzname) {
			if (__tzset_js.called) return;
			__tzset_js.called = true;
			_tzset_impl(timezone, daylight, tzname);
		}
		function _abort() {
			abort('');
		}
		function _emscripten_get_heap_max() {
			return 2147483648;
		}
		var _emscripten_get_now;
		_emscripten_get_now = () => performance.now();
		function _emscripten_get_now_res() {
			return 1e3;
		}
		function _emscripten_memcpy_big(dest, src, num) {
			HEAPU8.copyWithin(dest, src, src + num);
		}
		function emscripten_realloc_buffer(size) {
			try {
				wasmMemory.grow((size - buffer.byteLength + 65535) >>> 16);
				updateGlobalBufferAndViews(wasmMemory.buffer);
				return 1;
			} catch (e) {}
		}
		function _emscripten_resize_heap(requestedSize) {
			var oldSize = HEAPU8.length;
			requestedSize = requestedSize >>> 0;
			var maxHeapSize = _emscripten_get_heap_max();
			if (requestedSize > maxHeapSize) {
				return false;
			}
			let alignUp = (x, multiple) => x + ((multiple - (x % multiple)) % multiple);
			for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
				var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
				overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
				var newSize = Math.min(
					maxHeapSize,
					alignUp(Math.max(requestedSize, overGrownHeapSize), 65536)
				);
				var replacement = emscripten_realloc_buffer(newSize);
				if (replacement) {
					return true;
				}
			}
			return false;
		}
		var ENV = {};
		function getExecutableName() {
			return thisProgram || './this.program';
		}
		function getEnvStrings() {
			if (!getEnvStrings.strings) {
				var lang =
					(
						(typeof navigator == 'object' && navigator.languages && navigator.languages[0]) ||
						'C'
					).replace('-', '_') + '.UTF-8';
				var env = {
					USER: 'web_user',
					LOGNAME: 'web_user',
					PATH: '/',
					PWD: '/',
					HOME: '/home/web_user',
					LANG: lang,
					_: getExecutableName()
				};
				for (var x in ENV) {
					if (ENV[x] === undefined) delete env[x];
					else env[x] = ENV[x];
				}
				var strings = [];
				for (var x in env) {
					strings.push(x + '=' + env[x]);
				}
				getEnvStrings.strings = strings;
			}
			return getEnvStrings.strings;
		}
		function _environ_get(__environ, environ_buf) {
			var bufSize = 0;
			getEnvStrings().forEach(function (string, i) {
				var ptr = environ_buf + bufSize;
				HEAP32[(__environ + i * 4) >> 2] = ptr;
				writeAsciiToMemory(string, ptr);
				bufSize += string.length + 1;
			});
			return 0;
		}
		function _environ_sizes_get(penviron_count, penviron_buf_size) {
			var strings = getEnvStrings();
			HEAP32[penviron_count >> 2] = strings.length;
			var bufSize = 0;
			strings.forEach(function (string) {
				bufSize += string.length + 1;
			});
			HEAP32[penviron_buf_size >> 2] = bufSize;
			return 0;
		}
		function _exit(status) {
			exit(status);
		}
		function _fd_close(fd) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				FS.close(stream);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return e.errno;
			}
		}
		function _fd_fdstat_get(fd, pbuf) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				var type = stream.tty ? 2 : FS.isDir(stream.mode) ? 3 : FS.isLink(stream.mode) ? 7 : 4;
				HEAP8[pbuf >> 0] = type;
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return e.errno;
			}
		}
		function _fd_pread(fd, iov, iovcnt, offset_low, offset_high, pnum) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				var num = SYSCALLS.doReadv(stream, iov, iovcnt, offset_low);
				HEAP32[pnum >> 2] = num;
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return e.errno;
			}
		}
		function _fd_pwrite(fd, iov, iovcnt, offset_low, offset_high, pnum) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				var num = SYSCALLS.doWritev(stream, iov, iovcnt, offset_low);
				HEAP32[pnum >> 2] = num;
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return e.errno;
			}
		}
		function _fd_read(fd, iov, iovcnt, pnum) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				var num = SYSCALLS.doReadv(stream, iov, iovcnt);
				HEAP32[pnum >> 2] = num;
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return e.errno;
			}
		}
		function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				var HIGH_OFFSET = 4294967296;
				var offset = offset_high * HIGH_OFFSET + (offset_low >>> 0);
				var DOUBLE_LIMIT = 9007199254740992;
				if (offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT) {
					return -61;
				}
				FS.llseek(stream, offset, whence);
				(tempI64 = [
					stream.position >>> 0,
					((tempDouble = stream.position),
					+Math.abs(tempDouble) >= 1
						? tempDouble > 0
							? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0
							: ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
						: 0)
				]),
					(HEAP32[newOffset >> 2] = tempI64[0]),
					(HEAP32[(newOffset + 4) >> 2] = tempI64[1]);
				if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return e.errno;
			}
		}
		function _fd_sync(fd) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				if (stream.stream_ops && stream.stream_ops.fsync) {
					return -stream.stream_ops.fsync(stream);
				}
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return e.errno;
			}
		}
		function _fd_write(fd, iov, iovcnt, pnum) {
			try {
				var stream = SYSCALLS.getStreamFromFD(fd);
				var num = SYSCALLS.doWritev(stream, iov, iovcnt);
				HEAP32[pnum >> 2] = num;
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e instanceof FS.ErrnoError)) throw e;
				return e.errno;
			}
		}
		function _getaddrinfo(node, service, hint, out) {
			var addr = 0;
			var port = 0;
			var flags = 0;
			var family = 0;
			var type = 0;
			var proto = 0;
			var ai;
			function allocaddrinfo(family, type, proto, canon, addr, port) {
				var sa, salen, ai;
				var errno;
				salen = family === 10 ? 28 : 16;
				addr = family === 10 ? inetNtop6(addr) : inetNtop4(addr);
				sa = _malloc(salen);
				errno = writeSockaddr(sa, family, addr, port);
				assert(!errno);
				ai = _malloc(32);
				HEAP32[(ai + 4) >> 2] = family;
				HEAP32[(ai + 8) >> 2] = type;
				HEAP32[(ai + 12) >> 2] = proto;
				HEAP32[(ai + 24) >> 2] = canon;
				HEAP32[(ai + 20) >> 2] = sa;
				if (family === 10) {
					HEAP32[(ai + 16) >> 2] = 28;
				} else {
					HEAP32[(ai + 16) >> 2] = 16;
				}
				HEAP32[(ai + 28) >> 2] = 0;
				return ai;
			}
			if (hint) {
				flags = HEAP32[hint >> 2];
				family = HEAP32[(hint + 4) >> 2];
				type = HEAP32[(hint + 8) >> 2];
				proto = HEAP32[(hint + 12) >> 2];
			}
			if (type && !proto) {
				proto = type === 2 ? 17 : 6;
			}
			if (!type && proto) {
				type = proto === 17 ? 2 : 1;
			}
			if (proto === 0) {
				proto = 6;
			}
			if (type === 0) {
				type = 1;
			}
			if (!node && !service) {
				return -2;
			}
			if (flags & ~(1 | 2 | 4 | 1024 | 8 | 16 | 32)) {
				return -1;
			}
			if (hint !== 0 && HEAP32[hint >> 2] & 2 && !node) {
				return -1;
			}
			if (flags & 32) {
				return -2;
			}
			if (type !== 0 && type !== 1 && type !== 2) {
				return -7;
			}
			if (family !== 0 && family !== 2 && family !== 10) {
				return -6;
			}
			if (service) {
				service = UTF8ToString(service);
				port = parseInt(service, 10);
				if (isNaN(port)) {
					if (flags & 1024) {
						return -2;
					}
					return -8;
				}
			}
			if (!node) {
				if (family === 0) {
					family = 2;
				}
				if ((flags & 1) === 0) {
					if (family === 2) {
						addr = _htonl(2130706433);
					} else {
						addr = [0, 0, 0, 1];
					}
				}
				ai = allocaddrinfo(family, type, proto, null, addr, port);
				HEAP32[out >> 2] = ai;
				return 0;
			}
			node = UTF8ToString(node);
			addr = inetPton4(node);
			if (addr !== null) {
				if (family === 0 || family === 2) {
					family = 2;
				} else if (family === 10 && flags & 8) {
					addr = [0, 0, _htonl(65535), addr];
					family = 10;
				} else {
					return -2;
				}
			} else {
				addr = inetPton6(node);
				if (addr !== null) {
					if (family === 0 || family === 10) {
						family = 10;
					} else {
						return -2;
					}
				}
			}
			if (addr != null) {
				ai = allocaddrinfo(family, type, proto, node, addr, port);
				HEAP32[out >> 2] = ai;
				return 0;
			}
			if (flags & 4) {
				return -2;
			}
			node = DNS.lookup_name(node);
			addr = inetPton4(node);
			if (family === 0) {
				family = 2;
			} else if (family === 10) {
				addr = [0, 0, _htonl(65535), addr];
			}
			ai = allocaddrinfo(family, type, proto, null, addr, port);
			HEAP32[out >> 2] = ai;
			return 0;
		}
		function _getentropy(buffer, size) {
			if (!_getentropy.randomDevice) {
				_getentropy.randomDevice = getRandomDevice();
			}
			for (var i = 0; i < size; i++) {
				HEAP8[(buffer + i) >> 0] = _getentropy.randomDevice();
			}
			return 0;
		}
		function getHostByName(name) {
			var ret = _malloc(20);
			var nameBuf = _malloc(name.length + 1);
			stringToUTF8(name, nameBuf, name.length + 1);
			HEAP32[ret >> 2] = nameBuf;
			var aliasesBuf = _malloc(4);
			HEAP32[aliasesBuf >> 2] = 0;
			HEAP32[(ret + 4) >> 2] = aliasesBuf;
			var afinet = 2;
			HEAP32[(ret + 8) >> 2] = afinet;
			HEAP32[(ret + 12) >> 2] = 4;
			var addrListBuf = _malloc(12);
			HEAP32[addrListBuf >> 2] = addrListBuf + 8;
			HEAP32[(addrListBuf + 4) >> 2] = 0;
			HEAP32[(addrListBuf + 8) >> 2] = inetPton4(DNS.lookup_name(name));
			HEAP32[(ret + 16) >> 2] = addrListBuf;
			return ret;
		}
		function _gethostbyaddr(addr, addrlen, type) {
			if (type !== 2) {
				setErrNo(5);
				return null;
			}
			addr = HEAP32[addr >> 2];
			var host = inetNtop4(addr);
			var lookup = DNS.lookup_addr(host);
			if (lookup) {
				host = lookup;
			}
			return getHostByName(host);
		}
		function _gethostbyname(name) {
			return getHostByName(UTF8ToString(name));
		}
		function _getloadavg(loadavg, nelem) {
			var limit = Math.min(nelem, 3);
			var doubleSize = 8;
			for (var i = 0; i < limit; i++) {
				HEAPF64[(loadavg + i * doubleSize) >> 3] = 0.1;
			}
			return limit;
		}
		function _getnameinfo(sa, salen, node, nodelen, serv, servlen, flags) {
			var info = readSockaddr(sa, salen);
			if (info.errno) {
				return -6;
			}
			var port = info.port;
			var addr = info.addr;
			var overflowed = false;
			if (node && nodelen) {
				var lookup;
				if (flags & 1 || !(lookup = DNS.lookup_addr(addr))) {
					if (flags & 8) {
						return -2;
					}
				} else {
					addr = lookup;
				}
				var numBytesWrittenExclNull = stringToUTF8(addr, node, nodelen);
				if (numBytesWrittenExclNull + 1 >= nodelen) {
					overflowed = true;
				}
			}
			if (serv && servlen) {
				port = '' + port;
				var numBytesWrittenExclNull = stringToUTF8(port, serv, servlen);
				if (numBytesWrittenExclNull + 1 >= servlen) {
					overflowed = true;
				}
			}
			if (overflowed) {
				return -12;
			}
			return 0;
		}
		var Protocols = { list: [], map: {} };
		function _setprotoent(stayopen) {
			function allocprotoent(name, proto, aliases) {
				var nameBuf = _malloc(name.length + 1);
				writeAsciiToMemory(name, nameBuf);
				var j = 0;
				var length = aliases.length;
				var aliasListBuf = _malloc((length + 1) * 4);
				for (var i = 0; i < length; i++, j += 4) {
					var alias = aliases[i];
					var aliasBuf = _malloc(alias.length + 1);
					writeAsciiToMemory(alias, aliasBuf);
					HEAP32[(aliasListBuf + j) >> 2] = aliasBuf;
				}
				HEAP32[(aliasListBuf + j) >> 2] = 0;
				var pe = _malloc(12);
				HEAP32[pe >> 2] = nameBuf;
				HEAP32[(pe + 4) >> 2] = aliasListBuf;
				HEAP32[(pe + 8) >> 2] = proto;
				return pe;
			}
			var list = Protocols.list;
			var map = Protocols.map;
			if (list.length === 0) {
				var entry = allocprotoent('tcp', 6, ['TCP']);
				list.push(entry);
				map['tcp'] = map['6'] = entry;
				entry = allocprotoent('udp', 17, ['UDP']);
				list.push(entry);
				map['udp'] = map['17'] = entry;
			}
			_setprotoent.index = 0;
		}
		function _getprotobyname(name) {
			name = UTF8ToString(name);
			_setprotoent(true);
			var result = Protocols.map[name];
			return result;
		}
		function _proc_exit(code) {
			procExit(code);
		}
		function __isLeapYear(year) {
			return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
		}
		function __arraySum(array, index) {
			var sum = 0;
			for (var i = 0; i <= index; sum += array[i++]) {}
			return sum;
		}
		var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
		var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
		function __addDays(date, days) {
			var newDate = new Date(date.getTime());
			while (days > 0) {
				var leap = __isLeapYear(newDate.getFullYear());
				var currentMonth = newDate.getMonth();
				var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
				if (days > daysInCurrentMonth - newDate.getDate()) {
					days -= daysInCurrentMonth - newDate.getDate() + 1;
					newDate.setDate(1);
					if (currentMonth < 11) {
						newDate.setMonth(currentMonth + 1);
					} else {
						newDate.setMonth(0);
						newDate.setFullYear(newDate.getFullYear() + 1);
					}
				} else {
					newDate.setDate(newDate.getDate() + days);
					return newDate;
				}
			}
			return newDate;
		}
		function _strftime(s, maxsize, format, tm) {
			var tm_zone = HEAP32[(tm + 40) >> 2];
			var date = {
				tm_sec: HEAP32[tm >> 2],
				tm_min: HEAP32[(tm + 4) >> 2],
				tm_hour: HEAP32[(tm + 8) >> 2],
				tm_mday: HEAP32[(tm + 12) >> 2],
				tm_mon: HEAP32[(tm + 16) >> 2],
				tm_year: HEAP32[(tm + 20) >> 2],
				tm_wday: HEAP32[(tm + 24) >> 2],
				tm_yday: HEAP32[(tm + 28) >> 2],
				tm_isdst: HEAP32[(tm + 32) >> 2],
				tm_gmtoff: HEAP32[(tm + 36) >> 2],
				tm_zone: tm_zone ? UTF8ToString(tm_zone) : ''
			};
			var pattern = UTF8ToString(format);
			var EXPANSION_RULES_1 = {
				'%c': '%a %b %d %H:%M:%S %Y',
				'%D': '%m/%d/%y',
				'%F': '%Y-%m-%d',
				'%h': '%b',
				'%r': '%I:%M:%S %p',
				'%R': '%H:%M',
				'%T': '%H:%M:%S',
				'%x': '%m/%d/%y',
				'%X': '%H:%M:%S',
				'%Ec': '%c',
				'%EC': '%C',
				'%Ex': '%m/%d/%y',
				'%EX': '%H:%M:%S',
				'%Ey': '%y',
				'%EY': '%Y',
				'%Od': '%d',
				'%Oe': '%e',
				'%OH': '%H',
				'%OI': '%I',
				'%Om': '%m',
				'%OM': '%M',
				'%OS': '%S',
				'%Ou': '%u',
				'%OU': '%U',
				'%OV': '%V',
				'%Ow': '%w',
				'%OW': '%W',
				'%Oy': '%y'
			};
			for (var rule in EXPANSION_RULES_1) {
				pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule]);
			}
			var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
			var MONTHS = [
				'January',
				'February',
				'March',
				'April',
				'May',
				'June',
				'July',
				'August',
				'September',
				'October',
				'November',
				'December'
			];
			function leadingSomething(value, digits, character) {
				var str = typeof value == 'number' ? value.toString() : value || '';
				while (str.length < digits) {
					str = character[0] + str;
				}
				return str;
			}
			function leadingNulls(value, digits) {
				return leadingSomething(value, digits, '0');
			}
			function compareByDay(date1, date2) {
				function sgn(value) {
					return value < 0 ? -1 : value > 0 ? 1 : 0;
				}
				var compare;
				if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
					if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
						compare = sgn(date1.getDate() - date2.getDate());
					}
				}
				return compare;
			}
			function getFirstWeekStartDate(janFourth) {
				switch (janFourth.getDay()) {
					case 0:
						return new Date(janFourth.getFullYear() - 1, 11, 29);
					case 1:
						return janFourth;
					case 2:
						return new Date(janFourth.getFullYear(), 0, 3);
					case 3:
						return new Date(janFourth.getFullYear(), 0, 2);
					case 4:
						return new Date(janFourth.getFullYear(), 0, 1);
					case 5:
						return new Date(janFourth.getFullYear() - 1, 11, 31);
					case 6:
						return new Date(janFourth.getFullYear() - 1, 11, 30);
				}
			}
			function getWeekBasedYear(date) {
				var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
				var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
				var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
				var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
				var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
				if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
					if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
						return thisDate.getFullYear() + 1;
					} else {
						return thisDate.getFullYear();
					}
				} else {
					return thisDate.getFullYear() - 1;
				}
			}
			var EXPANSION_RULES_2 = {
				'%a': function (date) {
					return WEEKDAYS[date.tm_wday].substring(0, 3);
				},
				'%A': function (date) {
					return WEEKDAYS[date.tm_wday];
				},
				'%b': function (date) {
					return MONTHS[date.tm_mon].substring(0, 3);
				},
				'%B': function (date) {
					return MONTHS[date.tm_mon];
				},
				'%C': function (date) {
					var year = date.tm_year + 1900;
					return leadingNulls((year / 100) | 0, 2);
				},
				'%d': function (date) {
					return leadingNulls(date.tm_mday, 2);
				},
				'%e': function (date) {
					return leadingSomething(date.tm_mday, 2, ' ');
				},
				'%g': function (date) {
					return getWeekBasedYear(date).toString().substring(2);
				},
				'%G': function (date) {
					return getWeekBasedYear(date);
				},
				'%H': function (date) {
					return leadingNulls(date.tm_hour, 2);
				},
				'%I': function (date) {
					var twelveHour = date.tm_hour;
					if (twelveHour == 0) twelveHour = 12;
					else if (twelveHour > 12) twelveHour -= 12;
					return leadingNulls(twelveHour, 2);
				},
				'%j': function (date) {
					return leadingNulls(
						date.tm_mday +
							__arraySum(
								__isLeapYear(date.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR,
								date.tm_mon - 1
							),
						3
					);
				},
				'%m': function (date) {
					return leadingNulls(date.tm_mon + 1, 2);
				},
				'%M': function (date) {
					return leadingNulls(date.tm_min, 2);
				},
				'%n': function () {
					return '\n';
				},
				'%p': function (date) {
					if (date.tm_hour >= 0 && date.tm_hour < 12) {
						return 'AM';
					} else {
						return 'PM';
					}
				},
				'%S': function (date) {
					return leadingNulls(date.tm_sec, 2);
				},
				'%t': function () {
					return '\t';
				},
				'%u': function (date) {
					return date.tm_wday || 7;
				},
				'%U': function (date) {
					var days = date.tm_yday + 7 - date.tm_wday;
					return leadingNulls(Math.floor(days / 7), 2);
				},
				'%V': function (date) {
					var val = Math.floor((date.tm_yday + 7 - ((date.tm_wday + 6) % 7)) / 7);
					if ((date.tm_wday + 371 - date.tm_yday - 2) % 7 <= 2) {
						val++;
					}
					if (!val) {
						val = 52;
						var dec31 = (date.tm_wday + 7 - date.tm_yday - 1) % 7;
						if (dec31 == 4 || (dec31 == 5 && __isLeapYear((date.tm_year % 400) - 1))) {
							val++;
						}
					} else if (val == 53) {
						var jan1 = (date.tm_wday + 371 - date.tm_yday) % 7;
						if (jan1 != 4 && (jan1 != 3 || !__isLeapYear(date.tm_year))) val = 1;
					}
					return leadingNulls(val, 2);
				},
				'%w': function (date) {
					return date.tm_wday;
				},
				'%W': function (date) {
					var days = date.tm_yday + 7 - ((date.tm_wday + 6) % 7);
					return leadingNulls(Math.floor(days / 7), 2);
				},
				'%y': function (date) {
					return (date.tm_year + 1900).toString().substring(2);
				},
				'%Y': function (date) {
					return date.tm_year + 1900;
				},
				'%z': function (date) {
					var off = date.tm_gmtoff;
					var ahead = off >= 0;
					off = Math.abs(off) / 60;
					off = (off / 60) * 100 + (off % 60);
					return (ahead ? '+' : '-') + String('0000' + off).slice(-4);
				},
				'%Z': function (date) {
					return date.tm_zone;
				},
				'%%': function () {
					return '%';
				}
			};
			pattern = pattern.replace(/%%/g, '\0\0');
			for (var rule in EXPANSION_RULES_2) {
				if (pattern.includes(rule)) {
					pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_2[rule](date));
				}
			}
			pattern = pattern.replace(/\0\0/g, '%');
			var bytes = intArrayFromString(pattern, false);
			if (bytes.length > maxsize) {
				return 0;
			}
			writeArrayToMemory(bytes, s);
			return bytes.length - 1;
		}
		function _system(command) {
			if (!command) return 0;
			setErrNo(52);
			return -1;
		}
		var FSNode = function (parent, name, mode, rdev) {
			if (!parent) {
				parent = this;
			}
			this.parent = parent;
			this.mount = parent.mount;
			this.mounted = null;
			this.id = FS.nextInode++;
			this.name = name;
			this.mode = mode;
			this.node_ops = {};
			this.stream_ops = {};
			this.rdev = rdev;
		};
		var readMode = 292 | 73;
		var writeMode = 146;
		Object.defineProperties(FSNode.prototype, {
			read: {
				get: function () {
					return (this.mode & readMode) === readMode;
				},
				set: function (val) {
					val ? (this.mode |= readMode) : (this.mode &= ~readMode);
				}
			},
			write: {
				get: function () {
					return (this.mode & writeMode) === writeMode;
				},
				set: function (val) {
					val ? (this.mode |= writeMode) : (this.mode &= ~writeMode);
				}
			},
			isFolder: {
				get: function () {
					return FS.isDir(this.mode);
				}
			},
			isDevice: {
				get: function () {
					return FS.isChrdev(this.mode);
				}
			}
		});
		FS.FSNode = FSNode;
		FS.staticInit();
		Module['FS_createPath'] = FS.createPath;
		Module['FS_createDataFile'] = FS.createDataFile;
		Module['FS_createPreloadedFile'] = FS.createPreloadedFile;
		Module['FS_unlink'] = FS.unlink;
		Module['FS_createLazyFile'] = FS.createLazyFile;
		Module['FS_createDevice'] = FS.createDevice;
		ERRNO_CODES = {
			EPERM: 63,
			ENOENT: 44,
			ESRCH: 71,
			EINTR: 27,
			EIO: 29,
			ENXIO: 60,
			E2BIG: 1,
			ENOEXEC: 45,
			EBADF: 8,
			ECHILD: 12,
			EAGAIN: 6,
			EWOULDBLOCK: 6,
			ENOMEM: 48,
			EACCES: 2,
			EFAULT: 21,
			ENOTBLK: 105,
			EBUSY: 10,
			EEXIST: 20,
			EXDEV: 75,
			ENODEV: 43,
			ENOTDIR: 54,
			EISDIR: 31,
			EINVAL: 28,
			ENFILE: 41,
			EMFILE: 33,
			ENOTTY: 59,
			ETXTBSY: 74,
			EFBIG: 22,
			ENOSPC: 51,
			ESPIPE: 70,
			EROFS: 69,
			EMLINK: 34,
			EPIPE: 64,
			EDOM: 18,
			ERANGE: 68,
			ENOMSG: 49,
			EIDRM: 24,
			ECHRNG: 106,
			EL2NSYNC: 156,
			EL3HLT: 107,
			EL3RST: 108,
			ELNRNG: 109,
			EUNATCH: 110,
			ENOCSI: 111,
			EL2HLT: 112,
			EDEADLK: 16,
			ENOLCK: 46,
			EBADE: 113,
			EBADR: 114,
			EXFULL: 115,
			ENOANO: 104,
			EBADRQC: 103,
			EBADSLT: 102,
			EDEADLOCK: 16,
			EBFONT: 101,
			ENOSTR: 100,
			ENODATA: 116,
			ETIME: 117,
			ENOSR: 118,
			ENONET: 119,
			ENOPKG: 120,
			EREMOTE: 121,
			ENOLINK: 47,
			EADV: 122,
			ESRMNT: 123,
			ECOMM: 124,
			EPROTO: 65,
			EMULTIHOP: 36,
			EDOTDOT: 125,
			EBADMSG: 9,
			ENOTUNIQ: 126,
			EBADFD: 127,
			EREMCHG: 128,
			ELIBACC: 129,
			ELIBBAD: 130,
			ELIBSCN: 131,
			ELIBMAX: 132,
			ELIBEXEC: 133,
			ENOSYS: 52,
			ENOTEMPTY: 55,
			ENAMETOOLONG: 37,
			ELOOP: 32,
			EOPNOTSUPP: 138,
			EPFNOSUPPORT: 139,
			ECONNRESET: 15,
			ENOBUFS: 42,
			EAFNOSUPPORT: 5,
			EPROTOTYPE: 67,
			ENOTSOCK: 57,
			ENOPROTOOPT: 50,
			ESHUTDOWN: 140,
			ECONNREFUSED: 14,
			EADDRINUSE: 3,
			ECONNABORTED: 13,
			ENETUNREACH: 40,
			ENETDOWN: 38,
			ETIMEDOUT: 73,
			EHOSTDOWN: 142,
			EHOSTUNREACH: 23,
			EINPROGRESS: 26,
			EALREADY: 7,
			EDESTADDRREQ: 17,
			EMSGSIZE: 35,
			EPROTONOSUPPORT: 66,
			ESOCKTNOSUPPORT: 137,
			EADDRNOTAVAIL: 4,
			ENETRESET: 39,
			EISCONN: 30,
			ENOTCONN: 53,
			ETOOMANYREFS: 141,
			EUSERS: 136,
			EDQUOT: 19,
			ESTALE: 72,
			ENOTSUP: 138,
			ENOMEDIUM: 148,
			EILSEQ: 25,
			EOVERFLOW: 61,
			ECANCELED: 11,
			ENOTRECOVERABLE: 56,
			EOWNERDEAD: 62,
			ESTRPIPE: 135
		};
		function intArrayFromString(stringy, dontAddNull, length) {
			var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
			var u8array = new Array(len);
			var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
			if (dontAddNull) u8array.length = numBytesWritten;
			return u8array;
		}
		var asmLibraryArg = {
			t: _Py_CheckEmscriptenSignals_Helper,
			wa: _Py_emscripten_runtime,
			ea: ___call_sighandler,
			x: ___map_file,
			aa: ___syscall__newselect,
			n: ___syscall_accept4,
			V: ___syscall_bind,
			A: ___syscall_chdir,
			z: ___syscall_chmod,
			T: ___syscall_connect,
			w: ___syscall_dup3,
			B: ___syscall_faccessat,
			H: ___syscall_fadvise64,
			sa: ___syscall_fchdir,
			ra: ___syscall_fchmod,
			u: ___syscall_fchmodat,
			qa: ___syscall_fchown32,
			y: ___syscall_fchownat,
			b: ___syscall_fcntl64,
			pa: ___syscall_fdatasync,
			oa: ___syscall_fstat64,
			_: ___syscall_fstatfs64,
			J: ___syscall_ftruncate64,
			ka: ___syscall_getcwd,
			da: ___syscall_getdents64,
			S: ___syscall_getpeername,
			R: ___syscall_getsockname,
			Q: ___syscall_getsockopt,
			D: ___syscall_ioctl,
			P: ___syscall_listen,
			ma: ___syscall_lstat64,
			r: ___syscall_mkdirat,
			i: ___syscall_newfstatat,
			e: ___syscall_openat,
			ga: ___syscall_pipe,
			fa: ___syscall_poll,
			q: ___syscall_readlinkat,
			O: ___syscall_recvfrom,
			N: ___syscall_recvmsg,
			p: ___syscall_renameat,
			ca: ___syscall_rmdir,
			M: ___syscall_sendmsg,
			L: ___syscall_sendto,
			m: ___syscall_socket,
			na: ___syscall_stat64,
			$: ___syscall_statfs64,
			Z: ___syscall_symlink,
			E: ___syscall_truncate64,
			o: ___syscall_unlinkat,
			X: ___syscall_utimensat,
			f: __emscripten_date_now,
			v: __emscripten_get_now_is_monotonic,
			ua: __gmtime_js,
			va: __localtime_js,
			xa: __mktime_js,
			ha: __mmap_js,
			ia: __msync_js,
			ja: __munmap_js,
			ya: __tzset_js,
			a: _abort,
			Y: _emscripten_get_heap_max,
			j: _emscripten_get_now,
			ta: _emscripten_get_now_res,
			za: _emscripten_memcpy_big,
			W: _emscripten_resize_heap,
			Ba: _environ_get,
			Ca: _environ_sizes_get,
			d: _exit,
			c: _fd_close,
			s: _fd_fdstat_get,
			G: _fd_pread,
			F: _fd_pwrite,
			k: _fd_read,
			I: _fd_seek,
			la: _fd_sync,
			h: _fd_write,
			g: _getaddrinfo,
			C: _getentropy,
			U: _gethostbyaddr,
			ba: _gethostbyname,
			Ea: _getloadavg,
			l: _getnameinfo,
			K: _getprotobyname,
			Aa: _proc_exit,
			Da: _strftime,
			Fa: _system
		};
		var asm = createWasm();
		var ___wasm_call_ctors = (Module['___wasm_call_ctors'] = function () {
			return (___wasm_call_ctors = Module['___wasm_call_ctors'] = Module['asm']['Ha']).apply(
				null,
				arguments
			);
		});
		var _main = (Module['_main'] = function () {
			return (_main = Module['_main'] = Module['asm']['Ia']).apply(null, arguments);
		});
		var ___errno_location = (Module['___errno_location'] = function () {
			return (___errno_location = Module['___errno_location'] = Module['asm']['Ja']).apply(
				null,
				arguments
			);
		});
		var _malloc = (Module['_malloc'] = function () {
			return (_malloc = Module['_malloc'] = Module['asm']['La']).apply(null, arguments);
		});
		var _ntohs = (Module['_ntohs'] = function () {
			return (_ntohs = Module['_ntohs'] = Module['asm']['Ma']).apply(null, arguments);
		});
		var _htons = (Module['_htons'] = function () {
			return (_htons = Module['_htons'] = Module['asm']['Na']).apply(null, arguments);
		});
		var _htonl = (Module['_htonl'] = function () {
			return (_htonl = Module['_htonl'] = Module['asm']['Oa']).apply(null, arguments);
		});
		var _emscripten_builtin_memalign = (Module['_emscripten_builtin_memalign'] = function () {
			return (_emscripten_builtin_memalign = Module['_emscripten_builtin_memalign'] =
				Module['asm']['Pa']).apply(null, arguments);
		});
		var stackAlloc = (Module['stackAlloc'] = function () {
			return (stackAlloc = Module['stackAlloc'] = Module['asm']['Qa']).apply(null, arguments);
		});
		var _Py_EMSCRIPTEN_SIGNAL_HANDLING = (Module['_Py_EMSCRIPTEN_SIGNAL_HANDLING'] = 3379008);
		Module['addRunDependency'] = addRunDependency;
		Module['removeRunDependency'] = removeRunDependency;
		Module['FS_createPath'] = FS.createPath;
		Module['FS_createDataFile'] = FS.createDataFile;
		Module['FS_createPreloadedFile'] = FS.createPreloadedFile;
		Module['FS_createLazyFile'] = FS.createLazyFile;
		Module['FS_createDevice'] = FS.createDevice;
		Module['FS_unlink'] = FS.unlink;
		var calledRun;
		function ExitStatus(status) {
			this.name = 'ExitStatus';
			this.message = 'Program terminated with exit(' + status + ')';
			this.status = status;
		}
		var calledMain = false;
		dependenciesFulfilled = function runCaller() {
			if (!calledRun) run();
			if (!calledRun) dependenciesFulfilled = runCaller;
		};
		function callMain(args) {
			var entryFunction = Module['_main'];
			args = args || [];
			var argc = args.length + 1;
			var argv = stackAlloc((argc + 1) * 4);
			HEAP32[argv >> 2] = allocateUTF8OnStack(thisProgram);
			for (var i = 1; i < argc; i++) {
				HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
			}
			HEAP32[(argv >> 2) + argc] = 0;
			try {
				var ret = entryFunction(argc, argv);
				exit(ret, true);
				return ret;
			} catch (e) {
				return handleException(e);
			} finally {
				calledMain = true;
			}
		}
		function run(args) {
			args = args || arguments_;
			if (runDependencies > 0) {
				return;
			}
			preRun();
			if (runDependencies > 0) {
				return;
			}
			function doRun() {
				if (calledRun) return;
				calledRun = true;
				Module['calledRun'] = true;
				if (ABORT) return;
				initRuntime();
				preMain();
				readyPromiseResolve(Module);
				if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();
				if (shouldRunNow) callMain(args);
				postRun();
			}
			if (Module['setStatus']) {
				Module['setStatus']('Running...');
				setTimeout(function () {
					setTimeout(function () {
						Module['setStatus']('');
					}, 1);
					doRun();
				}, 1);
			} else {
				doRun();
			}
		}
		Module['run'] = run;
		function exit(status, implicit) {
			EXITSTATUS = status;
			procExit(status);
		}
		function procExit(code) {
			EXITSTATUS = code;
			if (!keepRuntimeAlive()) {
				if (Module['onExit']) Module['onExit'](code);
				ABORT = true;
			}
			quit_(code, new ExitStatus(code));
		}
		if (Module['preInit']) {
			if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
			while (Module['preInit'].length > 0) {
				Module['preInit'].pop()();
			}
		}
		var shouldRunNow = true;
		if (Module['noInitialRun']) shouldRunNow = false;
		run();

		return createPythonModule.ready;
	};
})();
export default createPythonModule;
