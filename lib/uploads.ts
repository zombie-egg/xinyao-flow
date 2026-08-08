import crypto from 'node:crypto';import path from 'node:path';import {mkdir,writeFile} from 'node:fs/promises';

export const uploadRoot=process.env.UPLOAD_DIR||path.join(process.cwd(),'public','uploads');

export async function saveUpload(file:File,{prefix,subdirectory='',types,maxBytes}:{prefix:string;subdirectory?:string;types:Map<string,string>;maxBytes:number}){
  if(!types.has(file.type))throw new Error('INVALID_FILE_TYPE');
  if(file.size>maxBytes)throw new Error('FILE_TOO_LARGE');
  const directory=path.join(uploadRoot,subdirectory);await mkdir(directory,{recursive:true});
  const filename=`${prefix}-${crypto.randomUUID()}.${types.get(file.type)}`;await writeFile(path.join(directory,filename),Buffer.from(await file.arrayBuffer()),{mode:0o644});
  return `/uploads/${subdirectory?`${subdirectory}/`:''}${filename}`;
}

export function safeUploadPath(parts:string[]){
  if(!parts.length||parts.some(part=>!part||part==='.'||part==='..'||part.includes('/')||part.includes('\\')))return null;
  const resolved=path.resolve(uploadRoot,...parts),root=path.resolve(uploadRoot);
  return resolved.startsWith(`${root}${path.sep}`)?resolved:null;
}
