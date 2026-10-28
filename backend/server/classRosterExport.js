const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, TableLayoutType, HeightRule, VerticalAlign } = require('docx');
function rosterLayout(count) {
  const panels = count > 42 ? 2 : 1;
  const rows = Math.max(1, Math.ceil(count / panels));
  const rowHeight = Math.min(24, Math.floor(600 / (rows + 1)));
  return { panels, rows, rowHeight, fontSize: Math.min(11, rowHeight / (panels === 2 ? 2.2 : 1.6)) };
}
function studentName(student) {
  return student.name || [student.first_name, student.last_name].filter(Boolean).join(' ') || student.email || 'Unnamed student';
}
async function classRosterDocx(course, students) {
  const layout = rosterLayout(students.length);
  const showSections = students.some((student) => student.section_title && student.section_title !== course.title);
  const widths = layout.panels === 1 ? [600,1400,5000,3200] : [500,1000,2600,875,250,500,1000,2600,875];
  const cell = (text, width, header = false, shaded = false) => new TableCell({
    width: {size: width, type: WidthType.DXA}, verticalAlign: VerticalAlign.CENTER,
    margins: {top: 20,bottom:20,left:65,right:65},
    shading: {fill:header ? 'EEEEEE' : shaded ? 'F1F3F5' : 'FFFFFF'},
    children: [new Paragraph({spacing:{before:0,after:0,line:Math.round(layout.fontSize*20)},
      children:[new TextRun({text:String(text || ''),font:'Arial',size:Math.floor(layout.fontSize*2),bold:header})]})],
  });
  const headers = ['#','Student ID','Student name',showSections ? 'Cohort' : 'Notes'];
  const rows = [new TableRow({tableHeader:true,children:widths.map((width,index)=>cell(index===4?'':headers[index>4?index-5:index],width,true))})];
  for(let row=0;row<layout.rows;row++) {
    const values=[];
    for(let panel=0;panel<layout.panels;panel++) {
      if(panel)values.push('');
      const index=panel*layout.rows+row, student=students[index];
      values.push(...(student?[String(index+1),student.student_id || '',studentName(student),showSections ? student.section_title || '' : '']:['','','','']));
    }
    rows.push(new TableRow({cantSplit:true,height:{value:layout.rowHeight*20,rule:HeightRule.ATLEAST},children:values.map((text,index)=>cell(text,widths[index],false,row % 2 === 1))}));
  }
  return Packer.toBuffer(new Document({creator:'Super LMS',title:`${course.title} Class Roster`,
    styles:{default:{document:{run:{font:'Arial',size:20,color:'000000'},paragraph:{spacing:{after:0}}}}},
    sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:567,bottom:567,left:567,right:567}}},children:[
      new Paragraph({style:'Title',spacing:{after:100},children:[new TextRun({text:`${course.title || 'Class'} Class Roster`,bold:true,size:30,color:'000000'})]}),
      new Paragraph({spacing:{after:160},children:[new TextRun({text:`Total students: ${students.length}     Date: ____________________`,size:20})]}),
      new Table({width:{size:10200,type:WidthType.DXA},columnWidths:widths,layout:TableLayoutType.FIXED,rows}),
    ]}],
  }));
}
module.exports={classRosterDocx,rosterLayout,studentName};
