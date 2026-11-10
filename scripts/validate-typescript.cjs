/** Non-build syntax and local-import validation. Requires the TypeScript package. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let ts;
try { ts=require(require.resolve('typescript',{paths:[path.join(root,'frontend'),path.join(root,'mobile')]})); }
catch { console.error('TypeScript not installed. Run npm install in frontend/ and mobile/ first.');process.exit(2); }
const errors=[];const results={};
const exists=(p)=>[p,p+'.ts',p+'.tsx',p+'.js',p+'.json',path.join(p,'index.ts'),path.join(p,'index.tsx')].some(f=>fs.existsSync(f));
for(const client of ['frontend','mobile']){
  const base=path.join(root,client), files=[];
  function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(['node_modules','.next','.expo','dist','coverage'].includes(entry.name))continue;
    const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(ts|tsx)$/.test(entry.name))files.push(p);
  }}walk(base);
  let imports=0;
  for(const p of files){
    const content=fs.readFileSync(p,'utf8');
    const file=ts.createSourceFile(p,content,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    for(const e of file.parseDiagnostics){const line=file.getLineAndCharacterOfPosition(e.start||0).line+1;errors.push(`${path.relative(root,p)}:${line}: ${ts.flattenDiagnosticMessageText(e.messageText,' ')}`);}
    for(const node of file.statements){if(!ts.isImportDeclaration(node)||!ts.isStringLiteral(node.moduleSpecifier))continue;
      const spec=node.moduleSpecifier.text;if(!(spec.startsWith('.')||client==='frontend'&&spec.startsWith('@/')))continue;
      imports++;const resolved=spec.startsWith('@/')?path.join(base,spec.slice(2)):path.resolve(path.dirname(p),spec);
      if(!exists(resolved))errors.push(`Missing import: ${path.relative(root,p)} => ${spec}`);
    }
  }
  results[client]={sourceFiles:files.length,localImports:imports};
}
const app=path.join(root,'frontend/app'), pages=[];
function pagesWalk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())pagesWalk(p);else if(f.name==='page.tsx')pages.push(p);}}
pagesWalk(app);
const known=new Map();for(const p of pages){const route='/'+path.relative(app,p).split(path.sep).filter(x=>x!=='page.tsx'&&!/^\(.*\)$/.test(x)).join('/');if(known.has(route))errors.push(`Duplicate route ${route}`);known.set(route,p);}
results.routes=pages.length;results.errors=errors;
console.log(JSON.stringify(results,null,2));process.exit(errors.length?1:0);
