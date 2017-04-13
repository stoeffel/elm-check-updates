import test from "ava";
import { noUpdateNeeded } from "./index.js";

test(t => {
  t.true(noUpdateNeeded("0.1.2 <= v <= 0.2.3", "0.1.2"));
  t.true(noUpdateNeeded("0.1.2 <= v <= 0.2.3", "0.2.3"));
  t.false(noUpdateNeeded("0.1.2 <= v <= 0.2.3", "0.2.4"));
  t.true(noUpdateNeeded("0.1.2 <= v <= 0.1.2", "0.1.2"));
  t.false(noUpdateNeeded("0.1.2 <= v <= 0.1.2", "0.1.3"));
  t.false(noUpdateNeeded("0.1.2 <= v <= 0.1.2", "0.1.1"));
  t.true(noUpdateNeeded("0.1.2 <= v < 0.2.3", "0.2.2"));
  t.false(noUpdateNeeded("0.1.2 <= v < 0.2.3", "0.2.3"));
  t.false(noUpdateNeeded("0.1.2 < v < 0.2.3", "0.1.2"));
  t.true(noUpdateNeeded("0.1.2 < v < 0.2.3", "0.1.3"));
});
