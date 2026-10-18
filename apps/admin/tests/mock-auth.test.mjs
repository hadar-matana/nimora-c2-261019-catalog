import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptsMockCredentials,
  mockCredentials,
  normalizeMockInput,
} from "../src/lib/mock-auth.ts";

test("documented mock credentials are accepted", () => {
  assert.equal(acceptsMockCredentials("atelier", "demo123"), true);
  assert.deepEqual(mockCredentials, { username: "atelier", password: "demo123" });
});
test("copy-paste whitespace and username capitalization are tolerated in this demo", () => {
  for (const username of [
    " atelier ",
    "Atelier",
    "ATELIER",
    "\u2066atelier\u2069",
    "\u200eatelier\u200f",
  ]) {
    for (const password of ["demo123", " demo123 ", "demo123\u00a0", "\u2066demo123\u2069"]) {
      assert.equal(acceptsMockCredentials(username, password), true);
    }
  }
});
test("password case and internal whitespace remain significant", () => {
  for (const password of ["Demo123", "DEMO123", "demo 123", "wrong", "", "   "]) {
    assert.equal(acceptsMockCredentials("atelier", password), false);
  }
});
test("wrong usernames remain invalid and whitespace-only input is empty", () => {
  assert.equal(acceptsMockCredentials("other", "demo123"), false);
  assert.equal(acceptsMockCredentials("", "demo123"), false);
  assert.equal(normalizeMockInput(" \u2066\u2069\u200e "), "");
});
