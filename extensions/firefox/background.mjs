import {directSender,isSendCommand} from './client.mjs';
const send=directSender(browser);
// A named command grants activeTab and sends once. Never open an extension
// window, inject UI into the page, change focus or emit a system notification.
browser.commands.onCommand.addListener(async(name,tab)=>{
 if(!isSendCommand(name))return;
 const result=await send(tab);if(result.status==='busy')return;
 await browser.storage.session.set({lastShortcut:result});
 await browser.action.setBadgeText({text:result.status==='error'?'!':''});
 await browser.action.setTitle({title:result.status==='error'?'Clair Coding — '+result.text:'Clair Coding'});
});
