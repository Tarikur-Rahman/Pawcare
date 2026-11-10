 'use client';
import {useRef,useState} from 'react';
import {UploadCloud} from 'lucide-react';
export function ImageUploader({onUploaded}:{onUploaded?:(id:string)=>void}){
 const input=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function upload(file:File){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setMessage('Select a JPG, PNG or WebP image under 5 MB.');return;}
 setBusy(true);setMessage('');try{const data=new FormData();data.set('file',file);const res=await fetch('/api/relay/media',{method:'POST',credentials:'same-origin',headers:{'X-PawCare-Request':'web'},body:data});const json=await res.json();if(!res.ok)throw new Error(json.message||'Upload failed');const id=String(json.data?.id??json.data?.fileId??'');onUploaded?.(id);setMessage('Uploaded to private review storage. This image is not public yet.');}catch(e){setMessage(e instanceof Error?e.message:'Upload failed.');}finally{setBusy(false);}}
 return <div className="upload-box"><UploadCloud/><p>Upload an image for review</p><span>JPG, PNG or WebP · max 5 MB · private until approved</span><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);}}/><button disabled={busy} type="button" className="btn btn-secondary" onClick={()=>input.current?.click()}>{busy?'Uploading…':'Choose image'}</button>{message&&<p role="status" className="hint">{message}</p>}</div>;
}