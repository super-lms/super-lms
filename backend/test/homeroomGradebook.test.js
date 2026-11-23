const test=require('node:test'),assert=require('node:assert/strict');
const {assignedGrade,createHomeroomGradebook}=require('../server/homeroomGradebook');
test('explicit account mapping excludes other observers and unknown addresses',()=>{assert.equal(assignedGrade('bobliang@cbcschools.ca'),10);assert.equal(assignedGrade('venchiwu@cbcschools.ca'),11);assert.equal(assignedGrade('RichieXu@cbcschools.ca'),12);assert.equal(assignedGrade('GarfieldChen@cbcschools.ca'),12);assert.equal(assignedGrade('someone@cbcschools.ca'),null);});
function fixture(email='bobliang@cbcschools.ca'){
 const pool={query:async(sql)=>({rows:sql.includes('FROM users u WHERE')?[{id:1,school_id:2}]:sql.includes('WITH accounts')?[{student_user_id:10,current_grade:'Grade 10'},{student_user_id:11,current_grade:'11'}]:[{id:5,title:'CTS 10C'}]})};
 const handlers=createHomeroomGradebook({pool,readGradebook:(req,res)=>res.json({students:[{student_user_id:10},{student_user_id:11}],assignments:[]})});
 const res={code:200,status(c){this.code=c;return this;},json(d){this.data=d;return this;}};
 return {handlers,res,req:{user:{email},params:{classId:5}}};
}
test('read-only results exclude students outside the assigned grade',async()=>{const {handlers,res,req}=fixture();await handlers.gradebook(req,res);assert.equal(res.code,200);assert.deepEqual(res.data.students,[{student_user_id:10}]);assert.equal(res.data.read_only,true);});
test('forged course ID is rejected before loading its gradebook',async()=>{const {handlers,res,req}=fixture();req.params.classId=99;await handlers.gradebook(req,res);assert.equal(res.code,403);});
test('unassigned observer is denied',async()=>{const {handlers,res,req}=fixture('parent@test.ca');await handlers.courses(req,res);assert.equal(res.code,403);});
