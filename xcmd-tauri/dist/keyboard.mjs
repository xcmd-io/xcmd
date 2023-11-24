const Platform = {
	Unknown: 0,
	Mac: 1,
	Linux: 2,
	Windows: 3,
	Native: 1 << 2,
	Web: 1 << 3
};

const Browser = {
	Unknown: 0,
	InternetExplorer: 1,
	Edge: 2,
	Chrome: 3,
	Firefox: 4,
	WebKit: 5,
	Safari: 6,
	Opera: 7,
	Ipad: 8
}

const platform = determinePlatform();
const browser = determineBrowser();

function determinePlatform() {
	if (typeof process === 'object') {
		switch (process.platform) {
			case 'win32':
				return Platform.Native | Platform.Windows;
			case 'darwin':
				return Platform.Native | Platform.Mac;
			case 'linux':
				return Platform.Native | Platform.Linux;
			default:
				return Platform.Native | Platform.Unknown;
		}
	} else if (typeof navigator === 'object') {
		const userAgent = navigator.userAgent;
		if (userAgent.indexOf('Windows') !== -1)
			return Platform.Web | Platform.Windows;
		if (userAgent.indexOf('Macintosh') !== -1)
			return Platform.Web | Platform.Mac;
		if (userAgent.indexOf('Linux') !== -1)
			return Platform.Web | Platform.Linux;
	}
	return Platform.Unknown;
}

function determineBrowser() {
	if (typeof navigator === 'object') {
		const userAgent = navigator.userAgent;
		if (userAgent.indexOf('Trident') !== -1)
			return Browser.InternetExplorer;
		if (userAgent.indexOf('Edge/') !== -1)
			return Browser.Edge;
		if (userAgent.indexOf('Opera') !== -1)
			return Browser.Opera;
		if (userAgent.indexOf('Firefox') !== -1)
			return Browser.Firefox;
		if (userAgent.indexOf('AppleWebKit') !== -1)
			return Browser.WebKit;
		if (userAgent.indexOf('Chrome') !== -1)
			return Browser.Chrome;
		if (userAgent.indexOf('Chrome') === -1 && userAgent.indexOf('Safari') !== -1)
			return Browser.Safari;
		if (userAgent.indexOf('iPad') !== -1)
			return Browser.Ipad;
	}
	return Browser.Unknown;
}

export const Mod = {
	Ctrl: 1 << 15,
	Alt: 1 << 14,
	Shift: 1 << 13,
	Meta: 1 << 12,
};

export const Code = {
	Unknown: 0,
	PauseBreak: 1,
	Backspace: 2,
	Tab: 3,
	Enter: 4,
	Shift: 5,
	Ctrl: 6,
	Alt: 7,
	CapsLock: 8,
	Escape: 9,
	Space: 10,
	PageUp: 11,
	PageDown: 12,
	End: 13,
	Home: 14,
	LeftArrow: 15,
	UpArrow: 16,
	RightArrow: 17,
	DownArrow: 18,
	Insert: 19,
	Delete: 20,
	Key0: 21,
	Key1: 22,
	Key2: 23,
	Key3: 24,
	Key4: 25,
	Key5: 26,
	Key6: 27,
	Key7: 28,
	Key8: 29,
	Key9: 30,
	KeyA: 31,
	KeyB: 32,
	KeyC: 33,
	KeyD: 34,
	KeyE: 35,
	KeyF: 36,
	KeyG: 37,
	KeyH: 38,
	KeyI: 39,
	KeyJ: 40,
	KeyK: 41,
	KeyL: 42,
	KeyM: 43,
	KeyN: 44,
	KeyO: 45,
	KeyP: 46,
	KeyQ: 47,
	KeyR: 48,
	KeyS: 49,
	KeyT: 50,
	KeyU: 51,
	KeyV: 52,
	KeyW: 53,
	KeyX: 54,
	KeyY: 55,
	KeyZ: 56,
	Meta: 57,
	ContextMenu: 58,
	Numpad0: 59,
	Numpad1: 60,
	Numpad2: 61,
	Numpad3: 62,
	Numpad4: 63,
	Numpad5: 64,
	Numpad6: 65,
	Numpad7: 66,
	Numpad8: 67,
	Numpad9: 68,
	NumpadMultiply: 69,
	NumpadAdd: 70,
	NumpadSeparator: 71,
	NumpadSubtract: 72,
	NumpadDecimal: 73,
	NumpadDivide: 74,
	F1: 75,
	F2: 76,
	F3: 77,
	F4: 78,
	F5: 79,
	F6: 80,
	F7: 81,
	F8: 82,
	F9: 83,
	F10: 84,
	F11: 85,
	F12: 86,
	F13: 87,
	F14: 88,
	F15: 89,
	F16: 90,
	F17: 91,
	F18: 92,
	F19: 93,
	NumLock: 94,
	ScrollLock: 95,
	UsSemicolon: 96,
	UsEqual: 97,
	UsComma: 98,
	UsMinus: 99,
	UsDot: 100,
	UsSlash: 101,
	UsBacktick: 102,
	UsOpen_square_bracket: 103,
	UsBackslash: 104,
	UsClose_square_bracket: 105,
	UsQuote: 106,
	OEM_8: 107,
	OEM_102: 108,
};

/** @type {Record<number, number>} */
const KEY_CODE_MAP = {};
(function () {
	KEY_CODE_MAP[3] = Code.PauseBreak; // VK_CANCEL 0x03 Control-break processing
	KEY_CODE_MAP[8] = Code.Backspace;
	KEY_CODE_MAP[9] = Code.Tab;
	KEY_CODE_MAP[13] = Code.Enter;
	KEY_CODE_MAP[16] = Code.Shift;
	KEY_CODE_MAP[17] = Code.Ctrl;
	KEY_CODE_MAP[18] = Code.Alt;
	KEY_CODE_MAP[19] = Code.PauseBreak;
	KEY_CODE_MAP[20] = Code.CapsLock;
	KEY_CODE_MAP[27] = Code.Escape;
	KEY_CODE_MAP[32] = Code.Space;
	KEY_CODE_MAP[33] = Code.PageUp;
	KEY_CODE_MAP[34] = Code.PageDown;
	KEY_CODE_MAP[35] = Code.End;
	KEY_CODE_MAP[36] = Code.Home;
	KEY_CODE_MAP[37] = Code.LeftArrow;
	KEY_CODE_MAP[38] = Code.UpArrow;
	KEY_CODE_MAP[39] = Code.RightArrow;
	KEY_CODE_MAP[40] = Code.DownArrow;
	KEY_CODE_MAP[45] = Code.Insert;
	KEY_CODE_MAP[46] = Code.Delete;

	KEY_CODE_MAP[48] = Code.Key0;
	KEY_CODE_MAP[49] = Code.Key1;
	KEY_CODE_MAP[50] = Code.Key2;
	KEY_CODE_MAP[51] = Code.Key3;
	KEY_CODE_MAP[52] = Code.Key4;
	KEY_CODE_MAP[53] = Code.Key5;
	KEY_CODE_MAP[54] = Code.Key6;
	KEY_CODE_MAP[55] = Code.Key7;
	KEY_CODE_MAP[56] = Code.Key8;
	KEY_CODE_MAP[57] = Code.Key9;

	KEY_CODE_MAP[65] = Code.KeyA;
	KEY_CODE_MAP[66] = Code.KeyB;
	KEY_CODE_MAP[67] = Code.KeyC;
	KEY_CODE_MAP[68] = Code.KeyD;
	KEY_CODE_MAP[69] = Code.KeyE;
	KEY_CODE_MAP[70] = Code.KeyF;
	KEY_CODE_MAP[71] = Code.KeyG;
	KEY_CODE_MAP[72] = Code.KeyH;
	KEY_CODE_MAP[73] = Code.KeyI;
	KEY_CODE_MAP[74] = Code.KeyJ;
	KEY_CODE_MAP[75] = Code.KeyK;
	KEY_CODE_MAP[76] = Code.KeyL;
	KEY_CODE_MAP[77] = Code.KeyM;
	KEY_CODE_MAP[78] = Code.KeyN;
	KEY_CODE_MAP[79] = Code.KeyO;
	KEY_CODE_MAP[80] = Code.KeyP;
	KEY_CODE_MAP[81] = Code.KeyQ;
	KEY_CODE_MAP[82] = Code.KeyR;
	KEY_CODE_MAP[83] = Code.KeyS;
	KEY_CODE_MAP[84] = Code.KeyT;
	KEY_CODE_MAP[85] = Code.KeyU;
	KEY_CODE_MAP[86] = Code.KeyV;
	KEY_CODE_MAP[87] = Code.KeyW;
	KEY_CODE_MAP[88] = Code.KeyX;
	KEY_CODE_MAP[89] = Code.KeyY;
	KEY_CODE_MAP[90] = Code.KeyZ;

	KEY_CODE_MAP[93] = Code.ContextMenu;

	KEY_CODE_MAP[96] = Code.Numpad0;
	KEY_CODE_MAP[97] = Code.Numpad1;
	KEY_CODE_MAP[98] = Code.Numpad2;
	KEY_CODE_MAP[99] = Code.Numpad3;
	KEY_CODE_MAP[100] = Code.Numpad4;
	KEY_CODE_MAP[101] = Code.Numpad5;
	KEY_CODE_MAP[102] = Code.Numpad6;
	KEY_CODE_MAP[103] = Code.Numpad7;
	KEY_CODE_MAP[104] = Code.Numpad8;
	KEY_CODE_MAP[105] = Code.Numpad9;
	KEY_CODE_MAP[106] = Code.NumpadMultiply;
	KEY_CODE_MAP[107] = Code.NumpadAdd;
	KEY_CODE_MAP[108] = Code.NumpadSeparator;
	KEY_CODE_MAP[109] = Code.NumpadSubtract;
	KEY_CODE_MAP[110] = Code.NumpadDecimal;
	KEY_CODE_MAP[111] = Code.NumpadDivide;

	KEY_CODE_MAP[112] = Code.F1;
	KEY_CODE_MAP[113] = Code.F2;
	KEY_CODE_MAP[114] = Code.F3;
	KEY_CODE_MAP[115] = Code.F4;
	KEY_CODE_MAP[116] = Code.F5;
	KEY_CODE_MAP[117] = Code.F6;
	KEY_CODE_MAP[118] = Code.F7;
	KEY_CODE_MAP[119] = Code.F8;
	KEY_CODE_MAP[120] = Code.F9;
	KEY_CODE_MAP[121] = Code.F10;
	KEY_CODE_MAP[122] = Code.F11;
	KEY_CODE_MAP[123] = Code.F12;
	KEY_CODE_MAP[124] = Code.F13;
	KEY_CODE_MAP[125] = Code.F14;
	KEY_CODE_MAP[126] = Code.F15;
	KEY_CODE_MAP[127] = Code.F16;
	KEY_CODE_MAP[128] = Code.F17;
	KEY_CODE_MAP[129] = Code.F18;
	KEY_CODE_MAP[130] = Code.F19;

	KEY_CODE_MAP[144] = Code.NumLock;
	KEY_CODE_MAP[145] = Code.ScrollLock;

	KEY_CODE_MAP[186] = Code.UsSemicolon;
	KEY_CODE_MAP[187] = Code.UsEqual;
	KEY_CODE_MAP[188] = Code.UsComma;
	KEY_CODE_MAP[189] = Code.UsMinus;
	KEY_CODE_MAP[190] = Code.UsDot;
	KEY_CODE_MAP[191] = Code.UsSlash;
	KEY_CODE_MAP[192] = Code.UsBacktick;
	KEY_CODE_MAP[219] = Code.UsOpen_square_bracket;
	KEY_CODE_MAP[220] = Code.UsBackslash;
	KEY_CODE_MAP[221] = Code.UsClose_square_bracket;
	KEY_CODE_MAP[222] = Code.UsQuote;
	KEY_CODE_MAP[223] = Code.OEM_8;

	KEY_CODE_MAP[226] = Code.OEM_102;

	if (browser === Browser.InternetExplorer) {
		KEY_CODE_MAP[91] = Code.Meta;
	} else if (browser === Browser.Firefox) {
		KEY_CODE_MAP[59] = Code.UsSemicolon;
		KEY_CODE_MAP[107] = Code.UsEqual;
		KEY_CODE_MAP[109] = Code.UsMinus;
		if (platform === Platform.Mac) {
			KEY_CODE_MAP[224] = Code.Meta;
		}
	} else if (browser === Browser.WebKit) {
		KEY_CODE_MAP[91] = Code.Meta;
		if (platform === Platform.Mac) {
			KEY_CODE_MAP[93] = Code.Meta;
		} else {
			KEY_CODE_MAP[92] = Code.Meta;
		}
	}
})();

/**
 * @param {KeyboardEvent} e
 * @returns {number}
 */
export function getKey(e) {
	const code = KEY_CODE_MAP[e.keyCode] || Code.Unknown;
	let key = Code.Unknown;
	if (code !== Code.Ctrl && code !== Code.Shift && code !== Code.Alt && code !== Code.Meta) {
		key = code;
	}
	let result = 0;
	if (e.ctrlKey) {
		result |= Mod.Ctrl;
	}
	if (e.altKey) {
		result |= Mod.Alt;
	}
	if (e.shiftKey) {
		result |= Mod.Shift;
	}
	if (e.metaKey) {
		result |= Mod.Meta;
	}
	result |= key;
	return result;
}
