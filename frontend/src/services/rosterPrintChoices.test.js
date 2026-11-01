import test from "node:test";
import assert from "node:assert/strict";
import { buildRosterPrintChoices, rosterPrintEndpoint } from "./rosterPrintChoices.js";

test("legacy A root is only an exact cohort choice in the batch printer", () => {
  const choices = buildRosterPrintChoices([
    { id: 10, title: "CTS 10A", master_course_id: null },
    { id: 11, title: "CTS 10B", master_course_id: 10 },
    { id: 12, title: "CTS 10C", master_course_id: 10 },
    { id: 13, title: "CTS 10D", master_course_id: 10 },
  ]);

  assert.deepEqual(
    choices.map(({ key, typeLabel }) => [key, typeLabel]),
    [
      ["section:10", "Cohort"],
      ["section:11", "Cohort"],
      ["section:12", "Cohort"],
      ["section:13", "Cohort"],
    ]
  );
  assert.equal(rosterPrintEndpoint(choices[0]), "/api/class-roster/10?scope=section");
  assert.equal(choices.some((choice) => choice.scope === "master"), false);
});

test("explicit master course remains one combined choice and children are cohorts", () => {
  const choices = buildRosterPrintChoices([
    { id: 20, title: "Accounting 11 Master Class", master_course_id: null },
    { id: 21, title: "Accounting 11A", master_course_id: 20 },
    { id: 22, title: "Accounting 11B", master_course_id: 20 },
  ]);

  assert.deepEqual(choices.map(({ key }) => key), ["master:20", "section:21", "section:22"]);
  assert.equal(rosterPrintEndpoint(choices[1]), "/api/class-roster/21?scope=section");
});

import {buildRosterViewChoices} from './rosterPrintChoices.js';
test('Accounting master and exact 11A have distinct scopes without changing course identities',()=>{
 const courses=[{id:144,title:'Accounting 11A'},{id:145,title:'Accounting 11B',master_course_id:144},{id:146,title:'Accounting 11C',master_course_id:144}];
 const choices=buildRosterViewChoices(courses);
 assert.deepEqual(choices.map(c=>[c.key,c.label]),[['master:144','Accounting 11'],['section:144','Accounting 11A'],['section:145','Accounting 11B'],['section:146','Accounting 11C']]);
 assert.equal(rosterPrintEndpoint(choices[0]),'/api/class-roster/144');
 assert.equal(rosterPrintEndpoint(choices[1]),'/api/class-roster/144?scope=section');
 assert.equal(courses[0].title,'Accounting 11A');
});
