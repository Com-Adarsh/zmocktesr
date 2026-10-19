import assert from "node:assert/strict";
import test from "node:test";
import { getOptionalUser } from "../lib/optional-user.ts";

function clientReturning(user, error = null) {
  return { auth: { getUser: async () => ({ data: { user }, error }) } };
}

test("a signed-out visitor can render public pages without a session", async () => {
  const missingSession = Object.assign(new Error("Auth session missing!"), {
    name: "AuthSessionMissingError", status: 400,
  });
  assert.equal(await getOptionalUser(clientReturning(null, missingSession)), null);
});

test("a verified signed-in user is returned", async () => {
  const user = { id: "verified-user" };
  assert.equal(await getOptionalUser(clientReturning(user)), user);
});

test("a successful response without a user is anonymous", async () => {
  assert.equal(await getOptionalUser(clientReturning(null)), null);
});

test("unexpected authentication failures are not silently swallowed", async () => {
  await assert.rejects(
    getOptionalUser(clientReturning(null, new Error("Auth service unavailable"))),
    /Unable to verify account: Auth service unavailable/,
  );
});

test("network exceptions are not mistaken for a missing session", async () => {
  const client = { auth: { getUser: async () => { throw new Error("Network unavailable"); } } };
  await assert.rejects(getOptionalUser(client), /Network unavailable/);
});
