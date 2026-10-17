// Source views only. These rectangles are not generated portrait/landscape art.
export const FIRST_PAGE_SOURCE_SHA256='fa1b62a0c1fdf9416f5283c4a81ea06680c4201e84e95559ab75a320aad1394f';
export const FIRST_PAGE_OVERVIEW=Object.freeze([514,0,2812,2160]);
export const FIRST_PAGE_PANELS=Object.freeze([
 [520,0,2806,1470],[520,1480,470,650],[990,1490,880,650],
 [1875,1480,475,650],[2360,1480,440,650],[2800,1480,526,650]
].map((rect,i)=>Object.freeze({id:`CM01-P01-K${String(i+1).padStart(2,'0')}`,rect:Object.freeze(rect)})));
export function sourceRect(page,panel=null){
 if(!Number.isInteger(page)||page<0||page>=11)throw Error('CMARVEL_SOURCE_PAGE_INVALID');
 if(panel!==null&&(!Number.isInteger(panel)||page!==0||panel<0||panel>=6))throw Error('CMARVEL_SOURCE_PANEL_INVALID');
 return page!==0?[0,0,3840,2160]:panel===null?FIRST_PAGE_OVERVIEW:FIRST_PAGE_PANELS[panel].rect;
}
export function readingPlace(value,search=''){
 const query=new URLSearchParams(search),forced=Number(query.get('page'));
 const page=query.has('page')&&Number.isInteger(forced)&&forced>=1&&forced<=11?forced-1:
  Number.isInteger(value?.page)&&value.page>=0&&value.page<11?value.page:0;
 const panel=!query.has('page')&&page===0&&Number.isInteger(value?.panel)&&value.panel>=0&&value.panel<6?value.panel:null;
 return {page,panel};
}
