import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";

admin.initializeApp();
const db = admin.firestore();

const app = express();

/**
 * Configure CORS for AngularJS dev servers.
 * If you need other ports, add them here.
 */
app.use(
	cors({
		origin: ["http://localhost:4200", "http://localhost:4203"],
		credentials: true,
	})
);

app.use(express.json());

/**
 * Toggle auth in one place:
 * - false: public API (fast learning / easy)
 * - true: requires Firebase ID token for protected endpoints
 */
const AUTH_ENABLED = false;

// -------------------- Auth helpers --------------------
type AuthedRequest = express.Request & {
	user?: admin.auth.DecodedIdToken;
};

async function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
	if (!AUTH_ENABLED) return next();

	const header = req.header("Authorization") || "";
	const match = header.match(/^Bearer (.+)$/);
	if (!match) return res.status(401).json({ error: "missing_bearer_token" });

	try {
		const decoded = await admin.auth().verifyIdToken(match[1]);
		req.user = decoded;
		return next();
	} catch {
		return res.status(401).json({ error: "invalid_token" });
	}
}

/**
 * Firestore user profile lookup:
 * - stored in /users/{uid}
 * - role-based authorization uses this doc
 */
type UserProfile = {
	displayName: string;
	email: string;
	role: "admin" | "user";
	createdAt: number;
	updatedAt: number;
};

async function getProfile(uid: string): Promise<UserProfile | null> {
	const snap = await db.collection("users").doc(uid).get();
	if (!snap.exists) return null;
	return snap.data() as UserProfile;
}

function requireAdmin() {
	return async (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
		if (!AUTH_ENABLED) return next(); // no auth mode: allow all for learning
		if (!req.user?.uid) return res.status(401).json({ error: "unauthenticated" });

		const profile = await getProfile(req.user.uid);
		if (!profile) return res.status(403).json({ error: "profile_missing" });
		if (profile.role !== "admin") return res.status(403).json({ error: "admin_required" });

		return next();
	};
}

function requireSelfOrAdmin(paramUidKey: string = "id") {
	return async (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
		if (!AUTH_ENABLED) return next();
		if (!req.user?.uid) return res.status(401).json({ error: "unauthenticated" });

		const targetUid = req.params[paramUidKey];
		if (req.user.uid === targetUid) return next();

		const profile = await getProfile(req.user.uid);
		if (!profile) return res.status(403).json({ error: "profile_missing" });
		if (profile.role !== "admin") return res.status(403).json({ error: "forbidden" });

		return next();
	};
}

// -------------------- Utilities --------------------
function nowMs() {
	return Date.now();
}

function asNonEmptyString(v: any): string | null {
	if (typeof v !== "string") return null;
	const s = v.trim();
	return s.length ? s : null;
}

function asBool(v: any): boolean | null {
	if (typeof v === "boolean") return v;
	if (v === "true") return true;
	if (v === "false") return false;
	return null;
}

// -------------------- Health --------------------
app.get("/health", (_req, res) => res.json({ ok: true, authEnabled: AUTH_ENABLED }));

// ==================== TODOS ====================
type Todo = {
	title: string;
	done: boolean;
	projectId: string | null;
	ownerUid: string | null;
	createdAt: number;
	updatedAt: number;
};

app.get("/todos", requireAuth, async (req: AuthedRequest, res) => {
	// Optional filtering: ?projectId=... or ?ownerUid=...
	let q: FirebaseFirestore.Query = db.collection("todos");

	if (req.query.projectId) q = q.where("projectId", "==", String(req.query.projectId));
	if (req.query.ownerUid) q = q.where("ownerUid", "==", String(req.query.ownerUid));

	const snap = await q.orderBy("createdAt", "desc").get();
	res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

app.post("/todos", requireAuth, async (req: AuthedRequest, res) => {
	const title = asNonEmptyString(req.body?.title);
	if (!title) return res.status(400).json({ error: "title_required" });

	const done = asBool(req.body?.done) ?? false;
	const projectId = asNonEmptyString(req.body?.projectId);
	const ownerUid = AUTH_ENABLED ? (req.user?.uid ?? null) : (asNonEmptyString(req.body?.ownerUid) ?? null);

	const now = nowMs();
	const data: Todo = {
		title,
		done,
		projectId: projectId ?? null,
		ownerUid,
		createdAt: now,
		updatedAt: now,
	};

	const ref = await db.collection("todos").add(data);
	return res.status(201).json({ id: ref.id, ...data });
});

app.get("/todos/:id", requireAuth, async (req: AuthedRequest, res) => {
	const doc = await db.collection("todos").doc(req.params.id).get();
	if (!doc.exists) return res.status(404).json({ error: "not_found" });
	return res.json({ id: doc.id, ...doc.data() });
});

app.put("/todos/:id", requireAuth, async (req: AuthedRequest, res) => {
	const ref = db.collection("todos").doc(req.params.id);
	const snap = await ref.get();
	if (!snap.exists) return res.status(404).json({ error: "not_found" });

	const patch: Partial<Todo> = {};
	if (req.body?.title !== undefined) {
		const t = asNonEmptyString(req.body.title);
		if (!t) return res.status(400).json({ error: "title_required" });
		patch.title = t;
	}
	if (req.body?.done !== undefined) {
		const b = asBool(req.body.done);
		if (b === null) return res.status(400).json({ error: "done_must_be_boolean" });
		patch.done = b;
	}
	if (req.body?.projectId !== undefined) {
		patch.projectId = asNonEmptyString(req.body.projectId) ?? null;
	}

	patch.updatedAt = nowMs();

	await ref.update(patch);
	const updated = await ref.get();
	return res.json({ id: updated.id, ...updated.data() });
});

app.delete("/todos/:id", requireAuth, async (req: AuthedRequest, res) => {
	const ref = db.collection("todos").doc(req.params.id);
	const snap = await ref.get();
	if (!snap.exists) return res.status(404).json({ error: "not_found" });

	await ref.delete();
	return res.status(204).send();
});

// ==================== PROJECTS ====================
type Project = {
	name: string;
	description: string;
	ownerUid: string | null;
	createdAt: number;
	updatedAt: number;
};

app.get("/projects", requireAuth, async (_req, res) => {
	const snap = await db.collection("projects").orderBy("createdAt", "desc").get();
	res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

app.post("/projects", requireAuth, async (req: AuthedRequest, res) => {
	const name = asNonEmptyString(req.body?.name);
	if (!name) return res.status(400).json({ error: "name_required" });

	const description = String(req.body?.description ?? "");
	const ownerUid = AUTH_ENABLED ? (req.user?.uid ?? null) : (asNonEmptyString(req.body?.ownerUid) ?? null);

	const now = nowMs();
	const data: Project = {
		name,
		description,
		ownerUid,
		createdAt: now,
		updatedAt: now,
	};

	const ref = await db.collection("projects").add(data);
	return res.status(201).json({ id: ref.id, ...data });
});

app.get("/projects/:id", requireAuth, async (req, res) => {
	const doc = await db.collection("projects").doc(req.params.id).get();
	if (!doc.exists) return res.status(404).json({ error: "not_found" });
	return res.json({ id: doc.id, ...doc.data() });
});

app.put("/projects/:id", requireAuth, async (req, res) => {
	const ref = db.collection("projects").doc(req.params.id);
	const snap = await ref.get();
	if (!snap.exists) return res.status(404).json({ error: "not_found" });

	const patch: Partial<Project> = {};
	if (req.body?.name !== undefined) {
		const n = asNonEmptyString(req.body.name);
		if (!n) return res.status(400).json({ error: "name_required" });
		patch.name = n;
	}
	if (req.body?.description !== undefined) patch.description = String(req.body.description ?? "");
	patch.updatedAt = nowMs();

	await ref.update(patch);
	const updated = await ref.get();
	return res.json({ id: updated.id, ...updated.data() });
});

app.delete("/projects/:id", requireAuth, async (req, res) => {
	const ref = db.collection("projects").doc(req.params.id);
	const snap = await ref.get();
	if (!snap.exists) return res.status(404).json({ error: "not_found" });

	await ref.delete();
	return res.status(204).send();
});

// ==================== USERS (profiles) ====================
app.get("/users", requireAuth, requireAdmin(), async (_req, res) => {
	const snap = await db.collection("users").orderBy("createdAt", "desc").get();
	res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

/**
 * Create a user profile doc at /users/{uid}
 * In AUTH_ENABLED mode this should be admin-only.
 * In learning mode (AUTH_ENABLED=false), it’s open so you can practice.
 */
app.post("/users", requireAuth, requireAdmin(), async (req, res) => {
	const uid = asNonEmptyString(req.body?.uid);
	if (!uid) return res.status(400).json({ error: "uid_required" });

	const displayName = asNonEmptyString(req.body?.displayName) ?? "User";
	const email = asNonEmptyString(req.body?.email) ?? "";
	const roleRaw = asNonEmptyString(req.body?.role) ?? "user";
	const role = roleRaw === "admin" ? "admin" : "user";

	const now = nowMs();
	const data: UserProfile = {
		displayName,
		email,
		role,
		createdAt: now,
		updatedAt: now,
	};

	const ref = db.collection("users").doc(uid);
	const exists = (await ref.get()).exists;
	if (exists) return res.status(409).json({ error: "already_exists" });

	await ref.set(data);
	return res.status(201).json({ id: uid, ...data });
});

app.get("/users/:id", requireAuth, requireSelfOrAdmin("id"), async (req, res) => {
	const doc = await db.collection("users").doc(req.params.id).get();
	if (!doc.exists) return res.status(404).json({ error: "not_found" });
	return res.json({ id: doc.id, ...doc.data() });
});

app.put("/users/:id", requireAuth, requireSelfOrAdmin("id"), async (req, res) => {
	const ref = db.collection("users").doc(req.params.id);
	const snap = await ref.get();
	if (!snap.exists) return res.status(404).json({ error: "not_found" });

	const patch: Partial<UserProfile> = {};
	if (req.body?.displayName !== undefined) patch.displayName = asNonEmptyString(req.body.displayName) ?? "User";
	if (req.body?.email !== undefined) patch.email = asNonEmptyString(req.body.email) ?? "";

	// Only admin can change role when auth is enabled
	if (req.body?.role !== undefined) {
		if (AUTH_ENABLED) return res.status(403).json({ error: "role_change_disallowed_here" });
		const roleRaw = asNonEmptyString(req.body.role) ?? "user";
		patch.role = roleRaw === "admin" ? "admin" : "user";
	}

	patch.updatedAt = nowMs();

	await ref.update(patch);
	const updated = await ref.get();
	return res.json({ id: updated.id, ...updated.data() });
});

app.delete("/users/:id", requireAuth, requireAdmin(), async (req, res) => {
	const ref = db.collection("users").doc(req.params.id);
	const snap = await ref.get();
	if (!snap.exists) return res.status(404).json({ error: "not_found" });

	await ref.delete();
	return res.status(204).send();
});

// Export one HTTPS function: /api/*
export const api = functions.onRequest({region: "asia-southeast1"} ,app);
