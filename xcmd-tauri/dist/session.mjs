import Database from './modules/tauri-plugin-store-sql.mjs';

const LEFT_PANE_ID = 1;
const RIGHT_PANE_ID = 2;

/**
 * @param {TemplateStringsArray} strings
 * @param {any[]} slots
 * @returns {[string, any[]]}
 */
function sql(strings, ...slots) {
	return [strings.reduce((prev, curr, i) => `${prev}${'$'}${i}${curr}`), slots];
}

/** @type {Record<string, [string, any[]]>} */
const scripts = {
	init: sql`
		create table if not exists xcmd_metadata (
			name text,
			value text,
			primary key(name)
		) without rowid;
		insert or ignore into xcmd_metadata(name, value) values('version', 'init');
	`,

	v1: sql`
		create table xcmd_session (
			id integer primary key autoincrement,
			updated_at timestamp default current_timestamp
		);

		create table xcmd_tab (
			id integer primary key autoincrement,
			session_id integer not null,
			pane_id integer not null,
			name text,
			address text,
			system text,
			foreign key(session_id) references xcmd_session(id)
		);
	`,
};

const db = await Database.load('sqlite:state.sqlite');

/**
 * @returns {Promise<string>}
 */
async function selectVersion() {
	console.log('selecting version');
	const [{value: version}] = await db.select(`select value from xcmd_metadata where name='version'`);
	console.log('state db version', version);
	return version;
}

/**
 * @param {string} version
 */
async function updateVersion(version) {
	console.log(`update version to ${version}`);
	await db.execute(...sql`update xcmd_metadata set value=${version} where name='version'`)
}

/**
 * @returns {Promise<number>}
 */
async function createSession() {
	console.log('creating session');
	const { lastInsertId: sessionId } = await db.execute('insert into xcmd_session default values');
	console.log('created sessionId', sessionId);
	return sessionId;
}

/**
 * @param {number} fromSessionId
 * @returns {Promise<number>}
 */
async function cloneSession(fromSessionId) {
	const sessionId = await createSession();

	await db.execute(...sql`
		insert into xcmd_tab (session_id, pane_id, name, address, system)
		select ${sessionId}, pane_id, name, address, system
		from xcmd_tab
		where session_id=${fromSessionId};`)

	return sessionId;
}

/**
 * @param {number} sessionId
 */
async function updateSession(sessionId) {
	console.log('updating session');
	const { lastInsertId, rowsAffected } = await db.execute(...sql`
		update xcmd_session
		set updated_at=current_timestamp
		where id=${sessionId}`);
	console.log('updated session', lastInsertId, rowsAffected);
}

async function deleteAbandonedSessions() {
	console.log('deleting abandoned sessions');
	const { lastInsertId, rowsAffected } =
		await db.execute(`
			delete from xcmd_tab where session_id in (select id from xcmd_session where updated_at<datetime('now', '-5 minutes'));
			delete from xcmd_session where updated_at<datetime('now', '-5 minutes')`);
	console.log('deleted abandoned sessions', lastInsertId, rowsAffected);
}

async function beginTransaction() {
	await db.execute('begin transaction;');

	return {
		completed: false,

		async commit() {
			await db.execute('commit;');
			this.completed = true;
		},

		async rollback() {
			await db.execute('rollback;');
			this.completed = true;
		},

		async close() {
			if (!this.completed) {
				await this.rollback();
			}
		},
	};
}

/**
 * @returns {Promise<string>} - Version.
 */
async function initialize() {
	console.log('init', ...scripts.init);
	await db.execute(...scripts.init);

	let currentVersion = await selectVersion();
	let shouldExecute = false;
	let lastVersion = currentVersion;

	for (const [version, script] of Object.entries(scripts)) {
		if (version === currentVersion) {
			shouldExecute = true;
			continue;
		}
		if (!shouldExecute) {
			continue;
		}

		const transaction = await beginTransaction();
		try {
			console.log(version, ...script);
			await db.execute(...script);
			await updateVersion(version);
			await transaction.commit();
		} finally {
			await transaction.close();
		}
		lastVersion = version;
	}

	return lastVersion;
}

/**
 * Returns last session identifier.
 * This can run before tables are created
 *
 * @returns {Promise<number | undefined>}
 */
async function selectLastSessionId() {
	console.log('selecting last session');
	const [{ id }] = await db.select(`select max(id) as id from xcmd_session`);
	console.log('last session', id);
	return id;
}

export class Tab {
	/** @type {number} */
	id;

	/** @type {number} */
	paneId;

	/** @type {string | undefined} */
	address;

	/** @type {string | undefined} */
	name;

	/** @type {string | undefined} */
	system;

	/**
	 * Constructor.
	 *
	 * @param {number} id
	 * @param {number} paneId
	 * @param {string | undefined} name
	 * @param {string | undefined} address
	 * @param {string | undefined} system
	 */
	constructor(id, paneId, name, address, system) {
		this.id = id;
		this.paneId = paneId;
		this.name = name;
		this.address = address;
		this.system = system;
	}
}

/**
 * @param {number} sessionId
 * @returns {Promise<Tab[]>}
 */
async function selectTabs(sessionId) {
	/** @type {[{ id: number, pane_id: number, name: string, address: string, system: string }]} */
	const tabRows = await db.select(...sql`select id, pane_id, name, address, system from xcmd_tab where session_id=${sessionId}`);

	return tabRows.map(tabRow => new Tab(
		tabRow.id,
		tabRow.pane_id,
		tabRow.name,
		tabRow.address,
		tabRow.system,
	));
}

/**
 * Inserts a new tab into a session.
 *
 * @param {number} sessionId
 * @param {number} paneId
 * @param {string | undefined} name
 * @param {string | undefined} address
 * @param {string | undefined} system
 * @returns {Promise<Tab>}
 */
export async function insertTab(sessionId, paneId, name, address, system) {
	console.log('creating tab');
	const { lastInsertId } = await db.execute(...sql`
		insert into xcmd_tab(session_id, pane_id, name, address, system)
		values(${sessionId}, ${paneId}, ${name}, ${address}, ${system})`);
	console.log('created tab', lastInsertId);
	return new Tab(lastInsertId, paneId, name, address, system);
}

/**
 * @param {number} id
 * @param {string} name
 * @param {string} address
 * @param {string} system
 */
export async function updateTab(id, name, address, system) {
	console.log('updating tab');
	const { lastInsertId } = await db.execute(...sql`
		update xcmd_tab
		set name=${name}, address=${address}, system=${system}
		where id=${id}`);
	console.log('updated tab', lastInsertId);
}

/**
 * @param {number} id
 */
export async function deleteTab(id) {
	console.log('deleting tab', id);
	const { rowsAffected } = await db.execute(`delete from xcmd_tab where id=${id}`);
	console.log('deleted tab', id, rowsAffected);
}
/**
 * Session.
 */
export class Session {
	/** @type {number} */
	sessionId;

	/** @type {Tab[]} */
	tabs;

	/**
	 * Constructor.
	 *
	 * @param {number} sessionId
	 * @param {Tab[]} tabs
	 */
	constructor(sessionId, tabs) {
		this.sessionId = sessionId;
		this.tabs = tabs;
	}
}

/**
 * @returns {Promise<Session>}
 */
export async function getSession() {
	// when window is reloaded, the session ID can be reused from session storage
	let sessionId = Number(sessionStorage.getItem('sessionId'))

	// when program is started, we need to create a new session
	if (!sessionId) {
		// initialize database in case the program is running for the first time ever
		await initialize();
		// if there is a last session, we will clone it
		// why clone and not reuse? because it can belong to another instance of a program running
		// a flag for abandoned sessions can be added in future to determine whether it can be reused
		const lastSessionId = await selectLastSessionId();
		// create session
		sessionId = lastSessionId !== undefined
			? await cloneSession(lastSessionId)
			: await createSession();
		// set it into session storage so the window remembers its session
		sessionStorage.setItem('sessionId', String(sessionId));
		await deleteAbandonedSessions();
		setInterval(async () => await updateSession(sessionId), 60_000);
	}
	console.log('sessionId', sessionId);

	// select tabs
	const tabs = await selectTabs(sessionId);

	// make sure there is at least one tab per pane
	for (const paneId of [LEFT_PANE_ID, RIGHT_PANE_ID]) {
		if (!tabs.filter(tab => tab.paneId === paneId).length) {
			const tab = await insertTab(sessionId, paneId, undefined, undefined, undefined);
			tabs.push(tab);
		}
	}

	// return session
	return new Session(sessionId, tabs);
}
