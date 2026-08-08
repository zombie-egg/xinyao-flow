'use client';
import {useEffect,useRef,useState} from 'react';
import {cleanPublicValue} from '@/lib/public-config';

type Point={latitude:number;longitude:number;accuracy?:number};
type LngLat={getLng:()=>number;getLat:()=>number};
type Overlay=object;
type MapInstance={destroy:()=>void;setFitView:(overlays?:Overlay[],immediately?:boolean,avoid?:number[],maxZoom?:number)=>void};
type Loader={load:(options:{key:string;version:string;plugins:string[]})=>Promise<unknown>};
type AMapApi={
  Map:new(node:HTMLElement,options:Record<string,unknown>)=>MapInstance;
  Marker:new(options:Record<string,unknown>)=>Overlay;
  Circle:new(options:Record<string,unknown>)=>Overlay;
  Geocoder:new(options?:Record<string,unknown>)=>{getAddress:(position:[number,number],callback:(status:string,result:{regeocode?:{formattedAddress?:string}})=>void)=>void};
  convertFrom:(position:[number,number],type:string,callback:(status:string,result:{locations?:LngLat[]})=>void)=>void;
};
declare global{interface Window{_AMapSecurityConfig?:{securityJsCode:string}}}

function convert(api:AMapApi,point:Point){return new Promise<[number,number]>((resolve,reject)=>api.convertFrom([point.longitude,point.latitude],'gps',(status,result)=>{const p=result.locations?.[0];if(status==='complete'&&p)resolve([p.getLng(),p.getLat()]);else reject(new Error('COORDINATE_CONVERT_FAILED'))}))}

export function LocationMap({company,current,radius}:{company:Point;current:Point|null;radius:number}){
  const node=useRef<HTMLDivElement>(null),[error,setError]=useState(''),[address,setAddress]=useState('');
  useEffect(()=>{let disposed=false,map:MapInstance|null=null;async function render(){
    const key=cleanPublicValue(process.env.NEXT_PUBLIC_AMAP_KEY),securityJsCode=cleanPublicValue(process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE);
    if(!key||!securityJsCode){setError('高德地图 Key 尚未配置');return}
    if(!node.current)return;
    try{
      window._AMapSecurityConfig={securityJsCode};
      const loaderModule=await import('@amap/amap-jsapi-loader'),loader=loaderModule.default as unknown as Loader;
      const api=await loader.load({key,version:'2.0',plugins:['AMap.Geocoder']}) as AMapApi;
      if(disposed||!node.current)return;
      const companyPosition=await convert(api,company),currentPosition=current?await convert(api,current):null;
      map=new api.Map(node.current,{viewMode:'2D',zoom:17,center:currentPosition||companyPosition,mapStyle:'amap://styles/normal',resizeEnable:true});
      const overlays:Overlay[]=[
        new api.Circle({map,center:companyPosition,radius,strokeColor:'#18181b',strokeWeight:2,fillColor:'#18181b',fillOpacity:.1}),
        new api.Marker({map,position:companyPosition,title:'公司考勤地点',content:'<div style="width:24px;height:24px;border-radius:50%;background:#18181b;border:4px solid white;box-shadow:0 2px 10px #0005"></div>',anchor:'center'}),
      ];
      if(currentPosition){overlays.push(new api.Marker({map,position:currentPosition,title:'设备真实位置',content:'<div style="width:22px;height:22px;border-radius:50%;background:#1677ff;border:4px solid white;box-shadow:0 2px 10px #1677ff88"></div>',anchor:'center'}));if(current?.accuracy)overlays.push(new api.Circle({map,center:currentPosition,radius:current.accuracy,strokeColor:'#1677ff',strokeWeight:1,fillColor:'#1677ff',fillOpacity:.08}))}
      map.setFitView(overlays,false,[55,55,55,55],18);
      const geocoder=new api.Geocoder();geocoder.getAddress(currentPosition||companyPosition,(status,result)=>{if(status==='complete'&&result.regeocode?.formattedAddress)setAddress(result.regeocode.formattedAddress)});
    }catch(e){console.error(e);setError('高德地图加载失败，请检查网络、Key 的域名白名单和安全密钥')}
  }void render();return()=>{disposed=true;map?.destroy()}},[company,current,radius]);
  return <div className="relative"><div ref={node} className="h-[300px] w-full rounded-xl bg-zinc-100 md:h-[360px]" aria-label="高德真实签到地图"/>{error&&<div className="absolute inset-0 grid place-items-center rounded-xl bg-zinc-100 px-8 text-center text-sm text-red-600">{error}</div>}<div className="absolute bottom-3 left-3 max-w-[85%] rounded-lg bg-white/95 px-3 py-2 text-xs text-zinc-700 shadow">{address||'正在解析真实地址…'}</div></div>;
}
