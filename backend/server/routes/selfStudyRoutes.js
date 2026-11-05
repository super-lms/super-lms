const express=require('express');
const {authenticateJWT,requireRole}=require('../../middleware/auth');
const {createSelfStudyNotices}=require('../selfStudyNotices');
function createSelfStudyRouter(pool){
 const router=express.Router(),notices=createSelfStudyNotices(pool);
 router.use(authenticateJWT,requireRole('admin','teacher','observer','parent','student'),(req,res,next)=>{res.set('Cache-Control','private, no-store');next()});
 const wrap=fn=>async(req,res)=>{try{await fn(req,res)}catch(error){if(!error.status)console.error('Self-study calendar:',error.message);res.status(error.status||(error.code==='23505'?409:500)).json({error:error.status?error.message:error.code==='23505'?'A notice already exists for that teacher, course and date. Open it to edit.':'Could not load or save self-study notices. Please retry.'})}};
 router.get('/courses',wrap(async(req,res)=>res.json({courses:await notices.courses(req.user)})));
 router.get('/notices',wrap(async(req,res)=>res.json({notices:await notices.list(req.user,req.query.from,req.query.to)})));
 router.post('/notices',wrap(async(req,res)=>res.status(201).json(await notices.save(req.user,req.body))));
 router.put('/notices/:id',wrap(async(req,res)=>res.json(await notices.save(req.user,req.body,Number(req.params.id)))));
 router.post('/notices/:id/cancel',wrap(async(req,res)=>res.json(await notices.cancel(req.user,Number(req.params.id)))));
 return router;
}
module.exports={createSelfStudyRouter};
