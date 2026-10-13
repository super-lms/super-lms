const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ensureAssignmentTimeZones}=require('./assignmentTime');

test('legacy date deadlines and timestamps migrate to full instants, with retry after failure',async()=>{
 let calls=0,sql;
 const pool={async query(statement){calls++;sql=statement;if(calls===1)throw Error('temporary migration failure');return {rows:[]};}};
 await assert.rejects(ensureAssignmentTimeZones(pool),/temporary/);
 await ensureAssignmentTimeZones(pool);
 assert.match(sql,/column_name = 'due_date' AND data_type IN \('date', 'timestamp without time zone'\)/);
 assert.match(sql,/due_date TYPE TIMESTAMPTZ USING due_date::timestamp AT TIME ZONE 'UTC'/);
 assert.match(sql,/available_from TYPE TIMESTAMPTZ USING available_from::timestamp AT TIME ZONE 'UTC'/);
 await ensureAssignmentTimeZones(pool);assert.equal(calls,2);
});
