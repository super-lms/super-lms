const crypto=require('node:crypto');
const TYPES=['Multiple Choice','Essay','Matching','Ranking','Form','Essay matching','Rating','Scale','Scoring','Range','Date / Time','Image Choice'];
function frequencyScale(text){if(!/\bnever\b/i.test(text)||!/\bsometimes\b/i.test(text)||!/\balways\b/i.test(text))return null;const labels=[...text.matchAll(/\b(?:almost never|never|sometimes|most of the times?|always)\b/gi)].map(m=>m[0]);return [...new Set(labels)]}
function parseSurveyText(text){
 const sharedScale=frequencyScale(String(text||'').split(/^(?:Q(?:uestion)?\s*)?\d+[.):]\s+/im)[0]);
 const lines=String(text||'').replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(s=>s&&!/^--\s*\d+\s*(?:of\s*\d+)?\s*--$/.test(s));
 const blocks=[];let current=null;
 for(const line of lines){const m=line.match(/^(?:Q(?:uestion)?\s*)?(\d+)[.):]\s+(.+)$/i);if(m){if(current)blocks.push(current);current={number:m[1],lines:[m[2]]};}else if(current)current.lines.push(line)}
 if(current)blocks.push(current);
 const warnings=[];
 if(!blocks.length){warnings.push('No numbered questions were detected. Number questions as 1., 2., etc. and import again.');return {questions:[],warnings}}
 const questions=blocks.slice(0,100).map(b=>{
 const raw=b.lines.join('\n');const explicit=b.lines.find(l=>/^type\s*:/i.test(l));
 const label=explicit?.replace(/^type\s*:\s*/i,'').toLowerCase();
 let type=TYPES.find(t=>t.toLowerCase()===label)||'Essay';
 let options=[],targets=[],prompt=[],issues=[];let ratingLabels=frequencyScale(raw)||sharedScale;
 for(const line of b.lines){if(/^(type|answer|correct answer|points|feedback)\s*:/i.test(line))continue;
 const choice=line.match(/^[A-Z][.)]\s+(.+)$/i);
 const parts=[...line.matchAll(/(?:^|\s+)[A-H][.)]\s+(.+?)(?=\s+[A-H][.)]\s+|$)/gi)];
 if(parts.length){options.push(...parts.map(m=>m[1].trim()));continue}
 if(/^options?\s*:/i.test(line)){options.push(...line.replace(/^options?\s*:\s*/i,'').split(/[|;]/).map(s=>s.trim()).filter(Boolean));continue}
 if(/^(targets?|matches|right column)\s*:/i.test(line)){targets.push(...line.replace(/^[^:]+:\s*/,'').split(/[|;]/).map(s=>s.trim()).filter(Boolean));continue}
 const field=line.match(/^(.+?):\s*[_\.]{3,}\s*$/);if(field){options.push(field[1]);continue}
 if(!/^[_\.\s]{3,}$/.test(line))prompt.push(line);
 }
 const title=prompt.join('\n')||b.lines[0];
 if(!label){if(ratingLabels)type='Rating';else if(/\b(match|matching)\b/i.test(raw))type=/\b(explain|essay|justify|describe)\b/i.test(raw)?'Essay matching':'Matching';else if(/\b(rank|ranking|order of preference)\b/i.test(raw))type='Ranking';else if(/\b(rate|rating)\b/i.test(raw)&&/\b[15]\b/.test(raw))type='Rating';else if(/\b(scale|strongly agree|strongly disagree)\b/i.test(raw))type='Scale';else if(/\b(date|time)\b/i.test(title)&&!/\b(describe|explain|why)\b/i.test(title))type='Date / Time';else if(options.length>=2)type=/[_\.]{3,}/.test(raw)?'Form':'Multiple Choice';else if(/\b(true or false|true\/false)\b/i.test(raw)){type='Multiple Choice';options=['True','False']}}
 if(['Matching','Essay matching','Form','Ranking','Multiple Choice','Image Choice'].includes(type)&&!options.length)issues.push('Add the options or row labels; the PDF layout did not reveal them.');
 if(type==='Matching'&&!targets.length)issues.push('Review the matching answers / right column.');
 if(!label&&type==='Essay')issues.push('Suggested essay response. Confirm whether this is a short answer or another question type.');
 if(label&&!TYPES.some(t=>t.toLowerCase()===label))issues.push('Unrecognized explicit question type; review the suggestion.');
 return {id:crypto.randomUUID(),title,type,required:true,...(type==='Rating'&&ratingLabels?{ratingLabels}:{}),options:[...new Set(options)],targets:[...new Set(targets)],source:raw,sourceNumber:b.number,issues};
 });
 if(blocks.length>100)warnings.push('Only the first 100 questions were imported. Split larger documents.');
 warnings.push('Automatic suggestions need review, especially tables, matching columns, and multi-column layouts.');
 return {questions,warnings};
}
function validateSurvey(body){if(typeof body.title!=='string'||!body.title.trim()||body.title.length>300)throw Error('Enter a survey title (up to 300 characters).');if(!Array.isArray(body.questions)||!body.questions.length||body.questions.length>100)throw Error('Add between 1 and 100 questions.');const ids=new Set();return body.questions.map(q=>{if(!q.id||typeof q.id!=='string'||ids.has(q.id)||typeof q.title!=='string'||!q.title.trim()||q.title.length>10000||!TYPES.includes(q.type))throw Error('Check question titles and types.');ids.add(q.id);const options=Array.isArray(q.options)?q.options.map(o=>String(o).trim()).filter(Boolean):[],targets=Array.isArray(q.targets)?q.targets.map(o=>String(o).trim()).filter(Boolean):[];if(options.length>100||targets.length>100||[...options,...targets].some(o=>o.length>2000))throw Error('Too many or oversized options.');if(['Multiple Choice','Matching','Ranking','Form','Essay matching','Image Choice'].includes(q.type)&&(!options.length||new Set(options).size!==options.length))throw Error('Add unique options or row labels.');if(q.type==='Matching'&&!targets.length)throw Error('Add matching answers.');if(q.type==='Image Choice'&&options.some(o=>!/^https:\/\//.test(o)))throw Error('Image choices require HTTPS URLs.');const ratingLabels=q.type==='Rating'&&Array.isArray(q.ratingLabels)?q.ratingLabels.map(x=>String(x).trim()).filter(Boolean):[];if(ratingLabels.length&&(ratingLabels.length<2||ratingLabels.length>10||new Set(ratingLabels).size!==ratingLabels.length||ratingLabels.some(x=>x.length>200)))throw Error('Add 2–10 unique rating labels.');return {id:q.id,title:q.title.trim(),type:q.type,required:!!q.required,options,targets,...(ratingLabels.length?{ratingLabels}:{})}})}
function validateResponse(body,qs){const s=body.student;if(!s||typeof s.name!=='string'||!s.name.trim()||!/^\S+@\S+\.\S+$/.test(s.email||'')||typeof s.class!=='string'||!s.class.trim()||!/^(?:[1-9]|1[0-2])$/.test(String(s.grade))||!['Male','Female','Prefer not to say'].includes(s.gender))throw Error('Complete all required student details.');if(Object.values(s).some(v=>typeof v!=='string'||v.length>300))throw Error('Student details are too long.');const answers={};for(const q of qs){const a=body.answers?.[q.id];const rows=['Matching','Form','Essay matching','Ranking'].includes(q.type);const empty=a===undefined||a===null||a===''||(Array.isArray(a)&&a.every(v=>!v));if(empty){if(q.required)throw Error('Please answer: '+q.title);continue}if(rows){if(!Array.isArray(a)||a.length!==q.options.length||a.some(v=>typeof v!=='string'||v.length>20000)||(q.required&&a.some(v=>!v.trim())))throw Error('Complete every row: '+q.title);if(q.type==='Matching'&&a.some(v=>v&&!q.targets.includes(v)))throw Error('Invalid matching answer.');if(q.type==='Ranking'&&(new Set(a).size!==a.length||a.some(v=>!q.options.includes(v))))throw Error('Invalid ranking.')}else if(typeof a!=='string'||a.length>20000)throw Error('Invalid response.');if(['Multiple Choice','Image Choice'].includes(q.type)&&!q.options.includes(a))throw Error('Invalid choice.');if(['Rating','Scale','Scoring','Range'].includes(q.type)&&(!Number.isFinite(Number(a))||(q.type!=='Scoring'&&(Number(a)<1||Number(a)>(q.type==='Rating'?(q.ratingLabels?.length||5):10)))))throw Error('Invalid numeric response.');if(q.type==='Rating'&&q.ratingLabels?.length&&!Number.isInteger(Number(a)))throw Error('Choose a rating label.');if(q.type==='Date / Time'&&!Number.isFinite(Date.parse(a)))throw Error('Invalid date / time.');answers[q.id]=a}return {student:{name:s.name.trim(),chineseName:(s.chineseName||'').trim(),email:s.email.trim(),grade:s.grade,class:s.class.trim(),gender:s.gender},answers}}
module.exports={parseSurveyText,validateSurvey,validateResponse,TYPES};
