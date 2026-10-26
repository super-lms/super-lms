const test=require('node:test'),assert=require('node:assert/strict');const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {Pool}=require('pg'),express=require('express'),jwt=require('jsonwebtoken'),{createStockGameRouter}=require('../server/routes/stockGameRoutes'),{chinaToday}=require('../server/fitnessRotation');const bin=process.env.POSTGRES_TEST_BIN;
test('manual-price stock game accounting and permissions against PostgreSQL',{skip:!bin},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stock-game-test-'));let pool,server,started=false;
 function pg(cmd,args){const r=spawnSync(path.join(bin,cmd),args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout)}
 try{
 pg('initdb',['-D',path.join(dir,'data'),'-A','trust','-U','test','--no-locale']);pg('pg_ctl',['-D',path.join(dir,'data'),'-l',path.join(dir,'server.log'),'-o',`-k ${dir} -h '' -p 58431`,'-w','start']);started=true;
 pool=new Pool({host:dir,port:58431,user:'test',database:'postgres'});
 await pool.query(`CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,first_name TEXT,last_name TEXT,email TEXT,school_id INTEGER);
 CREATE TABLE courses(id INTEGER PRIMARY KEY,title TEXT,teacher_id INTEGER,master_course_id INTEGER,is_live BOOLEAN DEFAULT true,school_id INTEGER);
 CREATE TABLE course_teachers(course_id INTEGER,teacher_id INTEGER);CREATE TABLE class_enrollments(class_id INTEGER,student_user_id INTEGER);
 INSERT INTO users(id,name,email,school_id) VALUES(3,'Accounting Teacher','teacher@test',1),(4,'Other Teacher','other@test',1),(9,'Other School Admin','admin@test',2),(10,'Student One','one@test',1),(11,'Student Two','two@test',1),(12,'Outsider','outsider@test',1);
 INSERT INTO users(id,name,email,school_id) SELECT n,'Student '||n,'student'||n||'@test',1 FROM generate_series(20,99)n;
 INSERT INTO courses(id,title,teacher_id,school_id) VALUES(1,'Accounting 11 for Grade 12s',3,1),(2,'Other class',4,1);
 INSERT INTO class_enrollments VALUES(1,10),(1,11),(2,12);INSERT INTO class_enrollments SELECT 1,n FROM generate_series(20,99)n;`);
 const app=express();app.use(express.json());app.use('/api/stock-game',createStockGameRouter(pool));await new Promise(r=>{server=app.listen(0,'127.0.0.1',r)});const base=`http://127.0.0.1:${server.address().port}/api/stock-game`;
 const teacher={id:3,role:'teacher'},other={id:4,role:'teacher'},student={id:10,role:'student'},second={id:11,role:'student'};
 async function request(user,method,url,body){const headers={'Content-Type':'application/json'};if(user)headers.Authorization='Bearer '+jwt.sign(user,process.env.JWT_SECRET||'super-lms-development-secret-change-before-production');const r=await fetch(base+url,{method,headers,body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()}}
 const today=chinaToday(),market=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),date=new Date(Date.parse(market)-86400000).toISOString().slice(0,10);
 const config={title:'Accounting Stock Game',start_date:new Date(Date.parse(today)-30*86400000).toISOString().slice(0,10),end_date:new Date(Date.parse(today)+30*86400000).toISOString().slice(0,10),valuation_date:date};
 const orders=price=>Array.from({length:10},(_,i)=>({side:'BUY',symbol:`S${i}.TO`,quantity:'1',price:String(price),source_url:`https://example.test/quote/S${i}.TO`,reason:'Sample research decision'}));
 let game,oneValue,twoValue;
 const trade=(who,orders,version,key=crypto.randomUUID())=>request(who,'POST',`/games/${game}/trades`,{orders,expected_version:version,price_date:date,client_order_id:key});
 const read=who=>request(who,'GET',`/games/${game}`);
 async function value(who,priceDate=date){const p=(await read(who)).body.portfolio;return request(who,'POST',`/games/${game}/valuations`,{price_date:priceDate,expected_version:p.state.trade_count,prices:Object.keys(p.state.positions).map(symbol=>({symbol,price:who.id===10?'1100':'500',source_url:'https://example.test/prices',explanation:'Student explanation of the price movement',research_url:'https://example.test/news'}))})}
 await t.test('teachers are scoped to assigned classes and their school',async()=>{
  assert.equal((await request(null,'GET','/courses')).status,401);assert.equal((await request(other,'POST','/courses/1/games',config)).status,403);assert.equal((await request({id:9,role:'admin'},'POST','/courses/1/games',config)).status,403);assert.equal((await request(student,'POST','/courses/1/games',config)).status,403);
  const r=await request(teacher,'POST','/courses/1/games',config);assert.equal(r.status,201);game=r.body.id;
  assert.equal((await request({id:12,role:'student'},'GET',`/games/${game}`)).status,403);
 });
 await t.test('shared game adds authorized classes without resetting accounts or granting outsiders access',async()=>{
  await pool.query(`INSERT INTO courses(id,title,teacher_id,school_id) VALUES(3,'Accounting 11A',3,1),(4,'Accounting 11B',3,1),(5,'Other School',3,2);INSERT INTO class_enrollments VALUES(3,11);DELETE FROM class_enrollments WHERE class_id=1 AND student_user_id=11;`);
  assert.equal((await read(second)).status,403);
  assert.equal((await request(teacher,'POST',`/games/${game}/classes`,{course_id:2})).status,403);
  assert.equal((await request(teacher,'POST',`/games/${game}/classes`,{course_id:5})).status,403);
  assert.equal((await request(student,'POST',`/games/${game}/classes`,{course_id:3})).status,403);
  for(const id of [3,4,3])assert.equal((await request(teacher,'POST',`/games/${game}/classes`,{course_id:id})).status,200);
  assert.equal((await read(second)).status,200);
  assert.ok((await request(second,'GET','/courses')).body.courses.some(c=>c.id===3));
  assert.equal((await request(second,'GET','/courses/3/games')).body.games[0].id,game);
  assert.equal((await read(teacher)).body.classes.length,3);
  assert.equal((await request({id:12,role:'student'},'GET',`/games/${game}`)).status,403);
 });
 await t.test('joining is idempotent, bank opens at 100000 CAD, and participation is capped at 80',async()=>{
  for(const who of [student,student,second])assert.equal((await request(who,'POST',`/games/${game}/join`,{})).status,200);
  assert.equal((await read(student)).body.portfolio.state.cash_cents,10000000);assert.equal((await read(teacher)).body.leaders.length,2);
  const cap=(await request(teacher,'POST','/courses/1/games',config)).body.id;await pool.query('INSERT INTO stock_game_players(game_id,student_id) SELECT $1,n FROM generate_series(20,99)n',[cap]);assert.equal((await request(student,'POST',`/games/${cap}/join`,{})).status,409);
 });
 await t.test('initial portfolio requires ten distinct stocks, handles fees and rejects overspending atomically',async()=>{
  assert.equal((await trade(student,orders(1000).slice(0,1),0)).status,400);const duplicate=orders(1000);duplicate[9].symbol=duplicate[0].symbol;assert.equal((await trade(student,duplicate,0)).status,400);
  assert.equal((await trade(student,orders(10000),0)).status,400);assert.equal((await read(student)).body.portfolio.transactions.length,0);
  const key=crypto.randomUUID();assert.equal((await trade(student,orders(1000),0,key)).status,200);assert.equal((await trade(student,orders(1000),0,key)).body.replayed,true);assert.equal((await read(student)).body.portfolio.state.cash_cents,8990000);
  assert.equal((await trade(second,orders(500),0)).status,200);
 });
 await t.test('daily research is complete, rankings use equity once and student account details stay private',async()=>{
  assert.equal((await request(student,'POST',`/games/${game}/valuations`,{price_date:date,expected_version:10,prices:[]})).status,400);
  const a=await value(student),b=await value(second);assert.equal(a.status,200);assert.equal(b.status,200);oneValue=a.body.id;twoValue=b.body.id;
  const r=await read(student);assert.equal(r.body.leaders[0].equity_cents,10090000);assert.equal(r.body.leaders[0].rank,1);assert.equal(r.body.leaders[1].equity_cents,9990000);
  assert.equal((await request(student,'GET',`/games/${game}?student_id=11`)).body.portfolio.player.student_id,10);
  const v=r.body.portfolio.valuations[0].snapshot;assert.equal(v.assets_cents,v.liabilities_cents+v.equity_cents);assert.equal(v.capital_cents+v.realized_cents+v.unrealized_cents,v.equity_cents);
 });
 await t.test('sales, replacement stocks and a concurrent duplicate submission cannot overdraw or oversell',async()=>{
  const sell={...orders(1100)[0],side:'SELL'};assert.equal((await trade(student,[{...sell,quantity:'2'}],10)).status,400);assert.equal((await trade(student,[{...orders(1)[0],symbol:'NEW.TO'}],10)).status,400);
  assert.equal((await trade(student,[sell],10)).status,200);assert.equal((await trade(student,[{...orders(1000)[0],symbol:'NEW.TO'}],11)).status,200);
  const attempts=await Promise.all([trade(student,[{...sell,symbol:'S1.TO'}],12),trade(student,[{...sell,symbol:'S1.TO'}],12)]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
  const r=await read(student);assert.equal(r.body.portfolio.state.trade_count,13);assert.equal(r.body.leaders.find(l=>l.student_id===10).current,false);
 });
 await t.test('weekly statement must balance and match the saved snapshot, including zero liabilities',async()=>{
  const base={valuation_id:twoValue,assets:'99900',liabilities:'0',equity:'99900',reflection:'I reconciled cash and investments this week.'};
  assert.equal((await request(second,'POST',`/games/${game}/reports`,{...base,liabilities:'1'})).status,400);assert.equal((await request(second,'POST',`/games/${game}/reports`,base)).status,200);
  assert.equal((await request(student,'POST',`/games/${game}/reports`,base)).status,400);assert.equal((await read(second)).body.portfolio.reports.length,1);
 });
 await t.test('a shared later price date requires fresh valuations and teacher review before frozen final results',async()=>{
  assert.equal((await request(teacher,'POST',`/games/${game}/finalize`,{confirm:true})).status,409);
  assert.equal((await request(teacher,'PUT',`/games/${game}/valuation-date`,{date:market})).status,200);assert.ok((await read(teacher)).body.leaders.every(l=>!l.current));
  oneValue=(await value(student,market)).body.id;twoValue=(await value(second,market)).body.id;
  assert.equal((await request(student,'POST',`/games/${game}/review`,{student_id:10,valuation_id:oneValue})).status,403);
  for(const [id,v]of[[10,oneValue],[11,twoValue]])assert.equal((await request(teacher,'POST',`/games/${game}/review`,{student_id:id,valuation_id:v})).status,200);
  assert.equal((await request(teacher,'POST',`/games/${game}/finalize`,{confirm:true})).status,200);assert.equal((await read(student)).body.game.status,'finalized');
  assert.equal((await value(student,market)).status,409);assert.equal((await request(student,'POST',`/games/${game}/join`,{})).status,409);assert.equal((await trade(student,[{...orders(1)[0]}],13)).status,409);
 });
 }finally{if(server)await new Promise(r=>server.close(r));await pool?.end();if(started)pg('pg_ctl',['-D',path.join(dir,'data'),'-m','immediate','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}
});
