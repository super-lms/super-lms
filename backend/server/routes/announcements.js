const express = require('express');
const multer = require('multer');
const path = require('node:path');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const { authenticateJWT, requireRole } = require('../../middleware/auth');
const types = { '.pdf':'application/pdf', '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.csv':'text/csv', '.txt':'text/plain', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg' };
function createAnnouncementsRouter(pool) {
  const router = express.Router();
  let ready;
  function ensure() {
    if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS school_announcements (
      id SERIAL PRIMARY KEY, school_id INTEGER, author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL, body TEXT NOT NULL, event_date DATE, pinned BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS school_announcement_files (
      id SERIAL PRIMARY KEY, announcement_id INTEGER NOT NULL REFERENCES school_announcements(id) ON DELETE CASCADE,
      filename TEXT NOT NULL, mime_type TEXT NOT NULL, file_data BYTEA NOT NULL);`).catch(error => { ready = null; throw error; });
    return ready;
  }
  router.use(authenticateJWT, requireRole('admin','teacher','student'));
  router.use(async (req,res,next) => {
    try {
      await ensure();
      const result = await pool.query('SELECT school_id FROM users WHERE id = $1', [req.user.id]);
      if (!result.rows.length) return res.status(403).json({error:'Account unavailable'});
      req.schoolId = result.rows[0].school_id;
      next();
    } catch(error) { next(error); }
  });
  const upload = multer({ storage:multer.memoryStorage(), limits:{fileSize:15*1024*1024,files:5,fields:10},
    fileFilter(req,file,done) { if(!types[path.extname(file.originalname).toLowerCase()]) return done(Object.assign(new Error('Unsupported file. Use PDF, DOCX, XLSX, CSV, text, or an image.'),{status:400})); done(null,true); } }).array('files',5);
  router.get('/', async (req,res,next) => {
    try {
      const result = await pool.query(`SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name,
        COALESCE((SELECT json_agg(json_build_object('id',f.id,'filename',f.filename,'mime_type',f.mime_type) ORDER BY f.id)
        FROM school_announcement_files f WHERE f.announcement_id=a.id),'[]'::json) AS files
        FROM school_announcements a JOIN users u ON u.id=a.author_id
        WHERE a.school_id IS NOT DISTINCT FROM $1 ORDER BY a.pinned DESC,a.created_at DESC,a.id DESC`,[req.schoolId]);
      res.json(result.rows);
    } catch(error) { next(error); }
  });
  async function save(req,res,next) {
    const title=String(req.body.title||'').trim(), body=String(req.body.body||'').trim();
    const eventDate=req.body.event_date||null;
    if (!title || title.length>200 || !body || body.length>20000) return res.status(400).json({error:'Enter a title (up to 200 characters) and message (up to 20,000 characters).'});
    if (eventDate && (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !Number.isFinite(Date.parse(eventDate)))) return res.status(400).json({error:'Choose a valid event date.'});
    let client;
    try {
      client=await pool.connect(); await client.query('BEGIN');
      let id=req.params.id;
      if (id) {
        const result=await client.query(`UPDATE school_announcements SET title=$1,body=$2,event_date=$3,pinned=$4,updated_at=NOW()
          WHERE id=$5 AND school_id IS NOT DISTINCT FROM $6 AND (author_id=$7 OR $8) RETURNING id`,[title,body,eventDate,req.body.pinned==='true',id,req.schoolId,req.user.id,req.user.role==='admin']);
        if (!result.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({error:'Announcement not found or cannot be edited.'}); }
      } else {
        const result=await client.query('INSERT INTO school_announcements (title,body,event_date,pinned,school_id,author_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',[title,body,eventDate,req.body.pinned==='true',req.schoolId,req.user.id]); id=result.rows[0].id;
      }
      const remove=JSON.parse(req.body.remove_files||'[]');
      if (!Array.isArray(remove) || remove.some(id=>!Number.isInteger(id))) throw new Error('Invalid attachment selection');
      await client.query('DELETE FROM school_announcement_files WHERE announcement_id=$1 AND id=ANY($2::INTEGER[])',[id,remove]);
      const count=await client.query('SELECT COUNT(*)::integer AS count FROM school_announcement_files WHERE announcement_id=$1',[id]);
      if (count.rows[0].count+(req.files||[]).length>5) { await client.query('ROLLBACK'); return res.status(400).json({error:'Keep no more than five attachments per announcement.'}); }
      for (const file of req.files||[]) await client.query('INSERT INTO school_announcement_files (announcement_id,filename,mime_type,file_data) VALUES ($1,$2,$3,$4)',[id,path.basename(file.originalname),types[path.extname(file.originalname).toLowerCase()],file.buffer]);
      await client.query('COMMIT'); res.json({id});
    } catch(error) { if(client) await client.query('ROLLBACK'); next(error); } finally { client?.release(); }
  }
  router.post('/',requireRole('admin','teacher'),upload,save);
  router.put('/:id',requireRole('admin','teacher'),upload,save);
  router.delete('/:id',requireRole('admin','teacher'),async(req,res,next)=>{
    try { const result=await pool.query('DELETE FROM school_announcements WHERE id=$1 AND school_id IS NOT DISTINCT FROM $2 AND (author_id=$3 OR $4) RETURNING id',[req.params.id,req.schoolId,req.user.id,req.user.role==='admin']);
      if(!result.rows.length) return res.status(404).json({error:'Announcement not found or cannot be deleted.'}); res.json({success:true});
    }catch(error){next(error);}
  });
  router.get('/files/:id',async(req,res,next)=>{
    try {
      const result=await pool.query(`SELECT f.* FROM school_announcement_files f JOIN school_announcements a ON a.id=f.announcement_id
        WHERE f.id=$1 AND a.school_id IS NOT DISTINCT FROM $2`,[req.params.id,req.schoolId]);
      const file=result.rows[0]; if(!file) return res.status(404).json({error:'Document not found'});
      const ext=path.extname(file.filename).toLowerCase();
      res.set('Cache-Control','private, no-store'); res.set('X-Content-Type-Options','nosniff');
      if(req.query.preview==='true' && ext==='.docx') return res.json({text:(await mammoth.extractRawText({buffer:file.file_data})).value});
      if(req.query.preview==='true' && ['.xlsx','.csv'].includes(ext)) {
        const book=XLSX.read(file.file_data,{type:'buffer',sheetRows:501});
        return res.json({sheets:book.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false}).slice(0,500)})),note:'Preview shows up to 500 rows per sheet. Download for the complete document.'});
      }
      if(req.query.preview==='true' && ext==='.txt') return res.json({text:file.file_data.toString('utf8')});
      res.type(file.mime_type); res.attachment(file.filename); res.send(file.file_data);
    }catch(error){next(error);}
  });
  router.use((error,req,res,next)=>{ console.error('Announcements:',error.message); res.status(error.status || (error instanceof multer.MulterError ? 400 : 500)).json({error:error.status ? error.message : error instanceof multer.MulterError?'Upload up to five files, each 15 MB or smaller.':'Unable to complete this announcement request. Please try again.'}); });
  return router;
}
module.exports={createAnnouncementsRouter};
