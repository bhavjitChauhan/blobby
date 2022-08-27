import type { ElementHandle } from 'puppeteer';

export {};

export interface LiveEditorError {
	type?: 'error';
	column?: number;
	line?: number;
	priority?: number;
	source?: string;
	text?: string;
	lint?: Object;
	infiniteLoopNodeType?: string;
}

declare global {
	interface Window {
		_runDone: boolean | undefined;
		_errors: Array<LiveEditorError> | undefined;
		LoopProtector: {
			prototype: {
				leave: any;
			};
		};
	}
}

export interface AceAjaxEditorElement extends Element {
	env: {
		editor: AceAjax.Editor;
	};
}
