import test from "node:test";
import assert from "node:assert/strict";
import { formatFuelType, isValidCoordinates, mapsDirectionsUrl, newEvents, normalizeRoads } from "../src/lib/logic.mjs";

test("normalizes unique motorway IDs and excludes invalid input", () => {
  assert.deepEqual(normalizeRoads("a7, A 8, abc, A7, A9999, A96"), ["A7", "A8", "A96"]);
});

test("builds an encoded Google Maps navigation URL", () => {
  const url = new URL(mapsDirectionsUrl("Ravensburg, Deutschland", "München Hbf", "Shell München"));
  assert.equal(url.hostname, "www.google.com");
  assert.equal(url.searchParams.get("origin"), "Ravensburg, Deutschland");
  assert.equal(url.searchParams.get("destination"), "München Hbf");
  assert.equal(url.searchParams.get("waypoints"), "Shell München");
  assert.equal(url.searchParams.get("dir_action"), "navigate");
});

test("only notifies on unseen event IDs", () => {
  assert.deepEqual(newEvents([{id:"one"}], [{id:"one"},{id:"two"}]), [{id:"two"}]);
});

test("checks coordinates and allowed fuel types", () => {
  assert.equal(isValidCoordinates(48.1,9.2), true);
  assert.equal(isValidCoordinates(180,10), false);
  assert.equal(formatFuelType("diesel"), "diesel");
  assert.equal(formatFuelType("kerosene"), "diesel");
});
