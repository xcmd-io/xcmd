declare module '*.css';

interface Window {
	__TAURI__: typeof import("@tauri-apps/api");
}

declare const process: {
	platform?: string;
};

declare interface FileInfo {
	/**
	 * Even if two files have same name, the key must be unique within a directory.
	 * Path consists of keys concatenated with "/".
	 */
	key: string;

	/**
	 * Indicates whether it is a directory.
	 */
	isDirectory: boolean;

	/**
	 * String identifying an icon. The value depends on icon type.
	 */
	icon: string;

	/**
	 * String identifying an alternative icon.
	 */
	iconAlt?: string;

	/**
	 * "file" to use file at specified path to get an icon from operating system; "shell" to use just a path
	 */
	iconType: string;

	/**
	 * Name shown to the user.
	 */
	name: string;

	/**
	 * Extension.
	 */
	extension: string;

	/**
	 * File size.
	 */
	size: number;

	/**
	 * File date.
	 */
	date: number;

	/**
	 * Attributes.
	 */
	attributes: string;

	/**
	 * Indicates whether the file is active.
	 */
	isActive: boolean;
}

declare interface ListRequest {
	/**
	 * Directory path.
	 */
	path?: string;

	/**
	 * Optional subdirectory key.
	 */
	key?: string;
}

declare interface ListResponse {
	list: {
		/**
		 * Directory path.
		 */
		path: string;

		/**
		 * Name.
		 */
		name: string;

		/**
		 * Files in the directory.
		 */
		files: FileInfo[];
	}
}
