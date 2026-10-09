function previewPens(rows, students) {
 if(!Array.isArray(rows)||!rows.length||rows.length>2000)throw new Error('Supply between 1 and 2000 student ID and PEN mappings.');
 const ids=new Set(),pens=new Set();
 return rows.map(r=>{
 const id=String(r.student_id||'').trim(),pen=String(r.pen||'').trim();
 let issue='';
 if(!id||!/^\d{9}$/.test(pen))issue='Student ID and a 9-digit PEN are required.';
 if(ids.has(id)||pens.has(pen))issue='Duplicate student ID or PEN in upload.';ids.add(id);pens.add(pen);
 const matches=students.filter(s=>String(s.student_id||'').trim()===id);
 const student=matches.length===1?matches[0]:null;
 if(!issue&&!student)issue=matches.length?'Multiple student records share this ID.':'Student ID not found.';
 if(!issue&&student.pen&&student.pen!==pen)issue='Existing PEN differs; review before replacing.';
 if(!issue&&students.some(s=>s.pen===pen&&s.id!==student.id))issue='PEN belongs to another student.';
 return {student_id:id,pen,source_name:String(r.name||''),name:student?.display_name||'',master_id:student?.id,existing_pen:student?.pen||'',issue,status:issue?'Review':student.pen===pen?'Already set':'Ready'};
 });
}
module.exports={previewPens};
