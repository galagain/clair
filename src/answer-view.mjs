// Only line breaks and **emphasis** are interpreted. Model text is never HTML.
export function answerLines(text){return String(text||'').split(/\r?\n/).map(line=>line.trim().replace(/^(?:[•*-]|\d+[.)])(?:\s+|$)/,'')).filter(Boolean);}
export function inlineParts(line){return line.split('**').map((text,index)=>({text,strong:index%2===1})).filter(part=>part.text);}
export function plainAnswer(text){return answerLines(text).map(line=>inlineParts(line).map(part=>part.text).join('')).join('\n');}
const sources=new WeakMap();
export function renderAnswer(element,text){
 let list=element.querySelector('.answer-ideas');
 if(!list){list=document.createElement('ul');list.className='answer-ideas';element.replaceChildren(list);}
 const lines=answerLines(text);
 lines.forEach((line,index)=>{
  let row=list.children[index];if(!row){row=document.createElement('li');row.dir='auto';list.append(row);}
  if(sources.get(row)===line)return;
  const nodes=inlineParts(line).map(part=>{if(!part.strong)return document.createTextNode(part.text);const node=document.createElement('strong');node.textContent=part.text;return node;});
  row.replaceChildren(...nodes);sources.set(row,line);
 });
 while(list.children.length>lines.length)list.lastElementChild.remove();
}
