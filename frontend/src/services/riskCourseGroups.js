import {getCourseSectionIdentity} from './courseSections.js'

// Prefer stored master links; title grouping supports older cohort records.
export function riskCourseGroups(courses) {
  const parents=new Map()
  const find=id=>{if(!parents.has(id))parents.set(id,id);if(parents.get(id)!==id)parents.set(id,find(parents.get(id)));return parents.get(id)}
  const join=(a,b)=>parents.set(find(a),find(b))
  const rows=Array.isArray(courses)?courses:[]
  const multiNames=new Set(rows.map(getCourseSectionIdentity).filter(i=>i.isMultiSection).map(i=>i.masterTitle.toLowerCase()))
  const names=new Map()
  for(const course of rows){
    const id=String(course.id)
    find(id)
    if(course.master_course_id)join(id,String(course.master_course_id))
    const identity=getCourseSectionIdentity(course)
    const name=identity.masterTitle.toLowerCase()
    if(multiNames.has(name)){
      if(names.has(name))join(id,names.get(name));else names.set(name,id)
    }
  }
  const groups=new Map()
  for(const course of rows){
    const key=`master:${find(String(course.id))}`
    if(!groups.has(key))groups.set(key,{key,sections:[]})
    groups.get(key).sections.push(course)
  }
  return [...groups.values()].map(group=>{
    const root=group.sections.find(c=>!c.master_course_id||String(c.master_course_id)===String(c.id))
    const first=root||group.sections[0]
    const identity=getCourseSectionIdentity(first.risk_master_title ? {title:first.risk_master_title} : first)
    const isMaster=group.sections.length>1||group.sections.some(c=>c.master_course_id)||identity.isMultiSection
    return {...group,masterTitle:identity.masterTitle,isMaster,sections:[...group.sections].sort((a,b)=>String(a.title).localeCompare(String(b.title)))}
  }).sort((a,b)=>a.masterTitle.localeCompare(b.masterTitle))
}
