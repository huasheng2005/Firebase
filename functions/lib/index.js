"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = __importStar(require("firebase-functions/v2/https"));
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
admin.initializeApp();
const db = admin.firestore();
const app = (0, express_1.default)();
/**
 * Configure CORS for AngularJS dev servers.
 * If you need other ports, add them here.
 */
app.use((0, cors_1.default)({
    origin: ["http://localhost:4200", "http://localhost:4203"],
    credentials: true,
}));
app.use(express_1.default.json());
/**
 * Toggle auth in one place:
 * - false: public API (fast learning / easy)
 * - true: requires Firebase ID token for protected endpoints
 */
const AUTH_ENABLED = false;
async function requireAuth(req, res, next) {
    if (!AUTH_ENABLED)
        return next();
    const header = req.header("Authorization") || "";
    const match = header.match(/^Bearer (.+)$/);
    if (!match)
        return res.status(401).json({ error: "missing_bearer_token" });
    try {
        const decoded = await admin.auth().verifyIdToken(match[1]);
        req.user = decoded;
        return next();
    }
    catch (_a) {
        return res.status(401).json({ error: "invalid_token" });
    }
}
async function getProfile(uid) {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists)
        return null;
    return snap.data();
}
function requireAdmin() {
    return async (req, res, next) => {
        var _a;
        if (!AUTH_ENABLED)
            return next(); // no auth mode: allow all for learning
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid))
            return res.status(401).json({ error: "unauthenticated" });
        const profile = await getProfile(req.user.uid);
        if (!profile)
            return res.status(403).json({ error: "profile_missing" });
        if (profile.role !== "admin")
            return res.status(403).json({ error: "admin_required" });
        return next();
    };
}
function requireSelfOrAdmin(paramUidKey = "id") {
    return async (req, res, next) => {
        var _a;
        if (!AUTH_ENABLED)
            return next();
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid))
            return res.status(401).json({ error: "unauthenticated" });
        const targetUid = req.params[paramUidKey];
        if (req.user.uid === targetUid)
            return next();
        const profile = await getProfile(req.user.uid);
        if (!profile)
            return res.status(403).json({ error: "profile_missing" });
        if (profile.role !== "admin")
            return res.status(403).json({ error: "forbidden" });
        return next();
    };
}
// -------------------- Utilities --------------------
function nowMs() {
    return Date.now();
}
function asNonEmptyString(v) {
    if (typeof v !== "string")
        return null;
    const s = v.trim();
    return s.length ? s : null;
}
function asBool(v) {
    if (typeof v === "boolean")
        return v;
    if (v === "true")
        return true;
    if (v === "false")
        return false;
    return null;
}
// -------------------- Health --------------------
app.get("/health", (_req, res) => res.json({ ok: true, authEnabled: AUTH_ENABLED }));
app.get("/todos", requireAuth, async (req, res) => {
    // Optional filtering: ?projectId=... or ?ownerUid=...
    let q = db.collection("todos");
    if (req.query.projectId)
        q = q.where("projectId", "==", String(req.query.projectId));
    if (req.query.ownerUid)
        q = q.where("ownerUid", "==", String(req.query.ownerUid));
    const snap = await q.orderBy("createdAt", "desc").get();
    res.json(snap.docs.map((d) => (Object.assign({ id: d.id }, d.data()))));
});
app.post("/todos", requireAuth, async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const title = asNonEmptyString((_a = req.body) === null || _a === void 0 ? void 0 : _a.title);
    if (!title)
        return res.status(400).json({ error: "title_required" });
    const done = (_c = asBool((_b = req.body) === null || _b === void 0 ? void 0 : _b.done)) !== null && _c !== void 0 ? _c : false;
    const projectId = asNonEmptyString((_d = req.body) === null || _d === void 0 ? void 0 : _d.projectId);
    const ownerUid = AUTH_ENABLED ? ((_f = (_e = req.user) === null || _e === void 0 ? void 0 : _e.uid) !== null && _f !== void 0 ? _f : null) : ((_h = asNonEmptyString((_g = req.body) === null || _g === void 0 ? void 0 : _g.ownerUid)) !== null && _h !== void 0 ? _h : null);
    const now = nowMs();
    const data = {
        title,
        done,
        projectId: projectId !== null && projectId !== void 0 ? projectId : null,
        ownerUid,
        createdAt: now,
        updatedAt: now,
    };
    const ref = await db.collection("todos").add(data);
    return res.status(201).json(Object.assign({ id: ref.id }, data));
});
app.get("/todos/:id", requireAuth, async (req, res) => {
    const doc = await db.collection("todos").doc(req.params.id).get();
    if (!doc.exists)
        return res.status(404).json({ error: "not_found" });
    return res.json(Object.assign({ id: doc.id }, doc.data()));
});
app.put("/todos/:id", requireAuth, async (req, res) => {
    var _a, _b, _c, _d;
    const ref = db.collection("todos").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists)
        return res.status(404).json({ error: "not_found" });
    const patch = {};
    if (((_a = req.body) === null || _a === void 0 ? void 0 : _a.title) !== undefined) {
        const t = asNonEmptyString(req.body.title);
        if (!t)
            return res.status(400).json({ error: "title_required" });
        patch.title = t;
    }
    if (((_b = req.body) === null || _b === void 0 ? void 0 : _b.done) !== undefined) {
        const b = asBool(req.body.done);
        if (b === null)
            return res.status(400).json({ error: "done_must_be_boolean" });
        patch.done = b;
    }
    if (((_c = req.body) === null || _c === void 0 ? void 0 : _c.projectId) !== undefined) {
        patch.projectId = (_d = asNonEmptyString(req.body.projectId)) !== null && _d !== void 0 ? _d : null;
    }
    patch.updatedAt = nowMs();
    await ref.update(patch);
    const updated = await ref.get();
    return res.json(Object.assign({ id: updated.id }, updated.data()));
});
app.delete("/todos/:id", requireAuth, async (req, res) => {
    const ref = db.collection("todos").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists)
        return res.status(404).json({ error: "not_found" });
    await ref.delete();
    return res.status(204).send();
});
app.get("/projects", requireAuth, async (_req, res) => {
    const snap = await db.collection("projects").orderBy("createdAt", "desc").get();
    res.json(snap.docs.map((d) => (Object.assign({ id: d.id }, d.data()))));
});
app.post("/projects", requireAuth, async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const name = asNonEmptyString((_a = req.body) === null || _a === void 0 ? void 0 : _a.name);
    if (!name)
        return res.status(400).json({ error: "name_required" });
    const description = String((_c = (_b = req.body) === null || _b === void 0 ? void 0 : _b.description) !== null && _c !== void 0 ? _c : "");
    const ownerUid = AUTH_ENABLED ? ((_e = (_d = req.user) === null || _d === void 0 ? void 0 : _d.uid) !== null && _e !== void 0 ? _e : null) : ((_g = asNonEmptyString((_f = req.body) === null || _f === void 0 ? void 0 : _f.ownerUid)) !== null && _g !== void 0 ? _g : null);
    const now = nowMs();
    const data = {
        name,
        description,
        ownerUid,
        createdAt: now,
        updatedAt: now,
    };
    const ref = await db.collection("projects").add(data);
    return res.status(201).json(Object.assign({ id: ref.id }, data));
});
app.get("/projects/:id", requireAuth, async (req, res) => {
    const doc = await db.collection("projects").doc(req.params.id).get();
    if (!doc.exists)
        return res.status(404).json({ error: "not_found" });
    return res.json(Object.assign({ id: doc.id }, doc.data()));
});
app.put("/projects/:id", requireAuth, async (req, res) => {
    var _a, _b, _c;
    const ref = db.collection("projects").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists)
        return res.status(404).json({ error: "not_found" });
    const patch = {};
    if (((_a = req.body) === null || _a === void 0 ? void 0 : _a.name) !== undefined) {
        const n = asNonEmptyString(req.body.name);
        if (!n)
            return res.status(400).json({ error: "name_required" });
        patch.name = n;
    }
    if (((_b = req.body) === null || _b === void 0 ? void 0 : _b.description) !== undefined)
        patch.description = String((_c = req.body.description) !== null && _c !== void 0 ? _c : "");
    patch.updatedAt = nowMs();
    await ref.update(patch);
    const updated = await ref.get();
    return res.json(Object.assign({ id: updated.id }, updated.data()));
});
app.delete("/projects/:id", requireAuth, async (req, res) => {
    const ref = db.collection("projects").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists)
        return res.status(404).json({ error: "not_found" });
    await ref.delete();
    return res.status(204).send();
});
// ==================== USERS (profiles) ====================
app.get("/users", requireAuth, requireAdmin(), async (_req, res) => {
    const snap = await db.collection("users").orderBy("createdAt", "desc").get();
    res.json(snap.docs.map((d) => (Object.assign({ id: d.id }, d.data()))));
});
/**
 * Create a user profile doc at /users/{uid}
 * In AUTH_ENABLED mode this should be admin-only.
 * In learning mode (AUTH_ENABLED=false), it’s open so you can practice.
 */
app.post("/users", requireAuth, requireAdmin(), async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const uid = asNonEmptyString((_a = req.body) === null || _a === void 0 ? void 0 : _a.uid);
    if (!uid)
        return res.status(400).json({ error: "uid_required" });
    const displayName = (_c = asNonEmptyString((_b = req.body) === null || _b === void 0 ? void 0 : _b.displayName)) !== null && _c !== void 0 ? _c : "User";
    const email = (_e = asNonEmptyString((_d = req.body) === null || _d === void 0 ? void 0 : _d.email)) !== null && _e !== void 0 ? _e : "";
    const roleRaw = (_g = asNonEmptyString((_f = req.body) === null || _f === void 0 ? void 0 : _f.role)) !== null && _g !== void 0 ? _g : "user";
    const role = roleRaw === "admin" ? "admin" : "user";
    const now = nowMs();
    const data = {
        displayName,
        email,
        role,
        createdAt: now,
        updatedAt: now,
    };
    const ref = db.collection("users").doc(uid);
    const exists = (await ref.get()).exists;
    if (exists)
        return res.status(409).json({ error: "already_exists" });
    await ref.set(data);
    return res.status(201).json(Object.assign({ id: uid }, data));
});
app.get("/users/:id", requireAuth, requireSelfOrAdmin("id"), async (req, res) => {
    const doc = await db.collection("users").doc(req.params.id).get();
    if (!doc.exists)
        return res.status(404).json({ error: "not_found" });
    return res.json(Object.assign({ id: doc.id }, doc.data()));
});
app.put("/users/:id", requireAuth, requireSelfOrAdmin("id"), async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    const ref = db.collection("users").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists)
        return res.status(404).json({ error: "not_found" });
    const patch = {};
    if (((_a = req.body) === null || _a === void 0 ? void 0 : _a.displayName) !== undefined)
        patch.displayName = (_b = asNonEmptyString(req.body.displayName)) !== null && _b !== void 0 ? _b : "User";
    if (((_c = req.body) === null || _c === void 0 ? void 0 : _c.email) !== undefined)
        patch.email = (_d = asNonEmptyString(req.body.email)) !== null && _d !== void 0 ? _d : "";
    // Only admin can change role when auth is enabled
    if (((_e = req.body) === null || _e === void 0 ? void 0 : _e.role) !== undefined) {
        if (AUTH_ENABLED)
            return res.status(403).json({ error: "role_change_disallowed_here" });
        const roleRaw = (_f = asNonEmptyString(req.body.role)) !== null && _f !== void 0 ? _f : "user";
        patch.role = roleRaw === "admin" ? "admin" : "user";
    }
    patch.updatedAt = nowMs();
    await ref.update(patch);
    const updated = await ref.get();
    return res.json(Object.assign({ id: updated.id }, updated.data()));
});
app.delete("/users/:id", requireAuth, requireAdmin(), async (req, res) => {
    const ref = db.collection("users").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists)
        return res.status(404).json({ error: "not_found" });
    await ref.delete();
    return res.status(204).send();
});
// Export one HTTPS function: /api/*
exports.api = functions.onRequest({ region: "asia-southeast1" }, app);
//# sourceMappingURL=index.js.map