import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const sessions = new Map();
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  function json(status, body) {
    res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
  }
  if (url.pathname === "/health") return json(200, { ready: true });
  if (url.pathname === "/auth/v1/token" && req.method === "POST") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const { email, password } = JSON.parse(raw);
    if (!["learner@example.test", "new@example.test"].includes(email) || password !== "local-fixture") {
      return json(400, { message: "Invalid credentials" });
    }
    const user = { id: randomUUID(), aud: "authenticated", role: "authenticated", email, user_metadata: {}, app_metadata: {}, created_at: new Date().toISOString() };
    const token = [encode({ alg: "HS256", typ: "JWT" }), encode({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 }), "dGVzdA"].join(".");
    sessions.set(token, { user, onboarded: email === "learner@example.test" });
    return json(200, { user, access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 3600 });
  }
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  const session = sessions.get(token);
  if (!session) return json(401, { message: "Session required" });
  if (url.pathname === "/auth/v1/user") return json(200, session.user);
  if (url.pathname === "/auth/v1/logout") {
    sessions.delete(token);
    return res.writeHead(204).end();
  }
  if (url.pathname === "/rest/v1/profiles") return json(200, [{ onboarding_completed: session.onboarded }]);
  if (["/rest/v1/learner_preferences", "/rest/v1/learning_goals"].includes(url.pathname)) return json(200, []);
  if (url.pathname === "/rest/v1/rpc/complete_onboarding" && req.method === "POST") {
    session.onboarded = true;
    return res.writeHead(204).end();
  }
  json(404, { message: "Unknown fixture endpoint" });
}).listen(54329, "127.0.0.1");
