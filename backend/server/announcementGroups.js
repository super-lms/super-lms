const XLSX = require('xlsx');
const groupHeading = value => normalize(value).replace(/^\d+\s+(?=[a-z]-\d+\s*[•·])/, '');
const normalize = value => String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
function readAnnouncementGroups(book) {
  const groups=[];
  for (const sheetName of book.SheetNames) {
    const rows=XLSX.utils.sheet_to_json(book.Sheets[sheetName],{header:1,defval:'',raw:false});
    const headerIndex=rows.findIndex(row=>row.some(cell=>['english name','英文名','英文姓名'].includes(normalize(cell)))&&row.some(cell=>['chinese name','中文名','中文姓名'].includes(normalize(cell))));
    if(headerIndex<0)continue;
    const headers=rows[headerIndex].map(normalize);
    const englishIndex=headers.findIndex(cell=>['english name','英文名','英文姓名'].includes(cell));
    const chineseIndex=headers.findIndex(cell=>['chinese name','中文名','中文姓名'].includes(cell));
    let groupIndex=headers.findIndex(cell=>['group','group name','name of the group','组名','小组'].includes(cell));
    if(groupIndex<0 && englishIndex!==0 && chineseIndex!==0)groupIndex=0;
    if(groupIndex<0)continue;
    const genericHeadings=['group','group name','name of the group','组名','小组'];
    let activeGroup=genericHeadings.includes(headers[groupIndex])?'':String(rows[headerIndex][groupIndex]??'').trim();
    for(let i=headerIndex+1;i<rows.length;i++){
      const row=rows[i],englishName=String(row[englishIndex]??'').trim(),chineseName=String(row[chineseIndex]??'').trim(),groupLabel=String(row[groupIndex]??'').trim();
      if(groupLabel && !genericHeadings.includes(normalize(groupLabel)) && groupHeading(groupLabel)!==groupHeading(activeGroup))activeGroup=groupLabel;
      if(!englishName&&!chineseName)continue;
      if(['english name','英文名','英文姓名'].includes(normalize(englishName))&&['chinese name','中文名','中文姓名'].includes(normalize(chineseName)))continue;
      groups.push({englishName,chineseName,groupName:activeGroup,sheetName});
    }
  }
  return groups;
}
module.exports={readAnnouncementGroups};
