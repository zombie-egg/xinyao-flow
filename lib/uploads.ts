import crypto from 'node:crypto';import path from 'node:path';import {mkdir,writeFile} from 'node:fs/promises';import sharp from 'sharp';

export const uploadRoot=process.env.UPLOAD_DIR||path.join(process.cwd(),'public','uploads');

export async function saveUpload(file:File,{prefix,subdirectory='',types,maxBytes,optimizeImage=true}:{prefix:string;subdirectory?:string;types:Map<string,string>;maxBytes:number;optimizeImage?:boolean}){
  if(!types.has(file.type))throw new Error('INVALID_FILE_TYPE');
  if(file.size>maxBytes)throw new Error('FILE_TOO_LARGE');
  const directory=path.join(uploadRoot,subdirectory);await mkdir(directory,{recursive:true});
  let extension=types.get(file.type)!;let data:Uint8Array=new Uint8Array(await file.arrayBuffer());
  if(optimizeImage&&file.type.startsWith('image/')&&data.length>600*1024){
    data=new Uint8Array(await sharp(data,{failOn:'none'}).rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer());extension='webp';
  }
  const filename=`${prefix}-${crypto.randomUUID()}.${extension}`;await writeFile(path.join(directory,filename),data,{mode:0o644});
  return `/uploads/${subdirectory?`${subdirectory}/`:''}${filename}`;
}

export function safeUploadPath(parts:string[]){
  if(!parts.length||parts.some(part=>!part||part==='.'||part==='..'||part.includes('/')||part.includes('\\')))return null;
  const resolved=path.resolve(uploadRoot,...parts),root=path.resolve(uploadRoot);
  return resolved.startsWith(`${root}${path.sep}`)?resolved:null;
}
