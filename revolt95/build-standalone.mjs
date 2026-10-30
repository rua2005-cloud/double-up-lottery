// Generate the offline edition from the same game, UI and styles as index.html.
import {readFileSync,writeFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
export function buildStandalone(){
  const html=read('index.html'),css=read('style.css');
  const engine=read('game-engine.mjs').replace(/^export /gm,'');
  const appFile=read('app.js');
  const firstLine=appFile.split('\n')[0];
  if(!firstLine.startsWith("import {CONFIG,createGame,"))throw Error('Unexpected engine import');
  const app=appFile.slice(firstLine.length+1);
  const link=html.match(/<link rel="stylesheet" href="[^"]+">/)?.[0];
  const script=html.match(/<script type="module" src="[^"]+"><\/script>/)?.[0];
  if(!link?.includes('style.css')||!script?.includes('app.js'))throw Error('Missing module assets');
  if(css.includes('</style>')||engine.includes('</script>')||app.includes('</script>'))throw Error('Inline terminator in sources');
  return html.replace(link,'<style>\n'+css+'\n</style>')
    .replace(script,'<script>\n'+engine+'\n\n'+app+'\n</script>');
}
if(process.argv[1]?.endsWith('build-standalone.mjs')){
  const output=buildStandalone(),target=new URL('standalone.html',import.meta.url);
  if(process.argv.includes('--check')){
    if(read('standalone.html')!==output){console.error('Standalone outdated; run node revolt95/build-standalone.mjs');process.exitCode=1;}
    else console.log('Standalone matches current game.');
  }else{writeFileSync(target,output,'utf8');console.log('Standalone updated.');}
}
