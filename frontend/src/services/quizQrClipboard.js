const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function qrDescriptionHtml(link,title,png){
 const url=new URL(link);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Invalid student link.');
 if(!/^data:image\/png;base64,[a-z0-9+/]+=*$/i.test(png)||png.length>400000)throw Error('Invalid QR image.');
 return `<p><a href="${escape(url.href)}"><img src="${png}" alt="Scan or tap to open ${escape(title)}" width="240" height="240"></a></p><p><a href="${escape(url.href)}">Open quiz: ${escape(title)}</a></p>`;
}
async function qrPng(qrUrl){
 const r=await fetch(qrUrl);if(!r.ok)throw Error('Could not load the QR code. Make sure the quiz is open.');const svg=await r.blob(),url=URL.createObjectURL(svg);
 try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Could not create the QR image.'));image.src=url});const canvas=document.createElement('canvas');canvas.width=canvas.height=480;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,480,480);ctx.drawImage(image,0,0,480,480);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not copy the QR image.')),'image/png'));}finally{URL.revokeObjectURL(url)}
}
function dataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})}
export async function copyQuizQr({link,title,qrUrl}){
 if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('This browser cannot copy a QR image. Use Copy link, or try an updated browser.');
 // Write immediately during the click; promised values preserve Safari user activation.
 const png=qrPng(qrUrl),html=png.then(dataUrl).then(data=>new Blob([qrDescriptionHtml(link,title,data)],{type:'text/html'}));
 await navigator.clipboard.write([new ClipboardItem({'image/png':png,'text/html':html,'text/plain':new Blob([link],{type:'text/plain'})})]);
}
