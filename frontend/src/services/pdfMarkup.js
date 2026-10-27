export function markupPoint(event,rect){return [Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))]}
export function strokeNear(stroke,point,tolerance=0.018){
 for(let i=0;i<stroke.points.length;i++){const a=stroke.points[i],b=stroke.points[Math.min(i+1,stroke.points.length-1)],dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/d)):0;if(Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)<tolerance+stroke.width/2)return true;}return false;
}
export async function markedPdf(bytes,marks,getViewport){
 const {PDFDocument,rgb,LineCapStyle}=await import('pdf-lib');const document=await PDFDocument.load(bytes);const pages=document.getPages();
 for(const s of marks){const page=pages[s.page-1];if(!page)throw Error('A mark refers to a missing PDF page.');const viewport=await getViewport(s.page),hex=s.color.slice(1),color=rgb(parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255);
 const points=s.points.map(p=>viewport.convertToPdfPoint(p[0]*viewport.width,p[1]*viewport.height));
 for(let i=0;i<points.length;i++){const a=points[i],b=points[Math.min(i+1,points.length-1)];page.drawLine({start:{x:a[0],y:a[1]},end:{x:b[0]+(a[0]===b[0]&&a[1]===b[1]?0.01:0),y:b[1]},thickness:s.width*viewport.width,color,opacity:s.tool==='highlight'?0.25:1,lineCap:LineCapStyle.Round});}}
 return document.save();
}
export async function pdfBase64(bytes){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(new Blob([bytes],{type:'application/pdf'}));})}
export function downloadPdf(bytes,name){const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
