// CLI completion can precede the site's published-deploy view. Only accept the
// exact expected ready deployment; waiting never publishes or changes a deploy.
export async function waitForPublishedDeploy({loadSite,expectedId,initialSite,attempts=16,delayMs=2000,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 if(!expectedId)throw Error('PRODUCTION_DEPLOY_NOT_READY');
 let current=initialSite;
 for(let attempt=0;attempt<attempts;attempt++){
  const deploy=current?.published_deploy;
  if(deploy?.id===expectedId&&deploy.state==='ready')return current;
  if(attempt+1<attempts){await wait(delayMs);current=await loadSite();}
 }
 throw Error('PRODUCTION_DEPLOY_NOT_READY');
}
