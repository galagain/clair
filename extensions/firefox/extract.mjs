// These two self-contained functions run only after a toolbar/shortcut action.
// No secrets are passed to either world. Page-returned data is always untrusted.
export function readPage({useSelection=true}={}){
 const visible=el=>!!el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none';
 const editors='.monaco-editor,.CodeMirror,.cm-editor,.ace_editor';
 const skip='script,style,noscript,template,svg,canvas,nav,header,footer,[role=navigation],input,textarea,select,button,[hidden],[aria-hidden=true]';
 const textOf=(root,max=24000,excludeEditors=true)=>{
  const out=[];let count=0,nodes=0;
  const visit=node=>{
   if(count>=max||++nodes>30000)return;
   if(node.nodeType===Node.TEXT_NODE){const text=node.textContent;if(text.trim()){out.push(text);count+=text.length;}return;}
   if(node.nodeType!==Node.ELEMENT_NODE||node.matches(skip)||!visible(node)||excludeEditors&&node.matches(editors))return;
   const block=/^(block|flex|grid|list-item|table-row)/.test(getComputedStyle(node).display)||node.tagName==='BR';
   if(block)out.push('\n');for(const child of node.childNodes)visit(child);if(block)out.push('\n');
  };
  visit(root);return {text:out.join('').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,max),truncated:count>=max||nodes>30000};
 };
 const selected=window.getSelection(),anchor=selected?.anchorNode;
 // A highlighted variable in the code editor is not the problem statement.
 const inEditor=(anchor?.nodeType===Node.ELEMENT_NODE?anchor:anchor?.parentElement)?.closest(editors);
 const selection=!useSelection||inEditor?'':String(selected||'').slice(0,24000);
 const root=[...document.querySelectorAll('main,[role=main]')].find(visible)||document.body;
 const page=root?textOf(root):{text:'',truncated:false};
 const candidates=[];
 for(const el of document.querySelectorAll('.cm-content,.CodeMirror-code,.ace_text-layer,.monaco-editor .view-lines,textarea[data-clair-code]')){
  if(!visible(el))continue;
  const lines=el.querySelectorAll('.cm-line,.CodeMirror-line,.ace_line,.view-line');
  const code=el.tagName==='TEXTAREA'?el.value:lines.length?[...lines].map(line=>line.textContent).join('\n'):el.innerText;
  if(code?.trim())candidates.push({label:'Texte de l’éditeur (à vérifier)',code:code.slice(0,32000),complete:el.tagName==='TEXTAREA',truncated:code.length>32000});
 }
 const outputs=[...document.querySelectorAll('[data-testid*=output],[data-testid*=console],.xterm-screen,[role=log]')].filter(visible).slice(0,4).map(el=>textOf(el,8000).text).filter(Boolean);
 return {title:document.title.slice(0,240),source:location.hostname,statement:selection||page.text,selected:!!selection,truncated:selection?String(window.getSelection()).length>24000:page.truncated,candidates:candidates.slice(0,10),tests:outputs.join('\n\n').slice(0,8000),frames:document.querySelectorAll('iframe').length};
}

export function readEditors(){
 const candidates=[],seen=new Set();
 const add=(code,label,language)=>{
  if(typeof code!=='string'||!code.trim()||seen.has(code)||candidates.length>=10)return;
  seen.add(code);candidates.push({code:code.slice(0,32000),label:String(label).slice(0,120),language:language==='cpp'||language==='c++'?'cpp':language==='python'?'python':null,complete:true,truncated:code.length>32000});
 };
 // Prefer attached models. Never scroll, focus, type into or execute the editor.
 try{
  const monaco=window.monaco?.editor;
  const attached=monaco?.getEditors?.().map(editor=>editor.getModel()).filter(Boolean);
  const models=attached?.length?attached:monaco?.getModels?.()||[];
  for(const [i,model] of models.slice(0,10).entries())add(model.getValue(),`Monaco · ${i+1}`,model.getLanguageId?.());
 }catch{}
 for(const el of document.querySelectorAll('.CodeMirror'))try{if(el.getClientRects().length&&el.CodeMirror)add(el.CodeMirror.getValue(),'CodeMirror',el.CodeMirror.getOption('mode'));}catch{}
 for(const el of document.querySelectorAll('.ace_editor'))try{const editor=el.env?.editor;if(el.getClientRects().length&&editor)add(editor.getValue(),'Ace',editor.session?.getMode?.().$id?.split('/').at(-1));}catch{}
 return candidates;
}

export function combineCapture(pages,models){
 const usable=pages.filter(result=>result.result).sort((a,b)=>a.frameId-b.frameId);
 if(!usable.length)throw Error('Page inaccessible. Collez l’énoncé et le code dans Clair.');
 const selected=usable.find(result=>result.result.selected);
 const main=usable.find(result=>result.frameId===0)?.result||usable[0].result;
 const statement=selected?.result.statement||[...new Set(usable.map(result=>result.result.statement).filter(Boolean))].join('\n\n');
 const modelFrames=new Set(models.filter(result=>Array.isArray(result.result)&&result.result.length).map(result=>result.frameId));
 const all=[...models.flatMap(result=>Array.isArray(result.result)?result.result:[]),...usable.filter(result=>!modelFrames.has(result.frameId)).flatMap(result=>result.result.candidates||[])];
 const candidates=all.filter((item,i)=>typeof item?.code==='string'&&all.findIndex(other=>other?.code===item.code)===i).slice(0,10);
 const warning=[];
 if(main.frames)warning.push('La page contient des cadres : vérifiez que l’énoncé et le code sont complets.');
 if(usable.some(result=>result.result.truncated)||statement.length>24000)warning.push('Énoncé tronqué : complétez-le si nécessaire.');
 if(!candidates.length)warning.push('Code non récupéré : collez-le ci-dessous ou dans Clair.');
 if(candidates.length>1)warning.push('Plusieurs éditeurs : choisissez le bon code.');
 return {statement:statement.slice(0,24000),tests:[...new Set(usable.map(result=>result.result.tests).filter(Boolean))].join('\n\n').slice(0,8000),title:main.title,source:main.source,candidates,warning:warning.join(' ')};
}
