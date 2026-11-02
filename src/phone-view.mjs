export async function installPhone(api,{snapshot}){
 const $=id=>document.getElementById(id);let active=false,timer=null,busy=false;
 function publish(){clearTimeout(timer);timer=null;if(active)api.phonePublish(snapshot());}
 function schedule(){if(active&&!timer)timer=setTimeout(publish,120);}
 const observer=new MutationObserver(schedule);
 function status(value){active=value.active;observer.disconnect();if(active){for(const id of ['session-panel','coding-panel'])observer.observe($(id),{subtree:true,childList:true,characterData:true,attributes:true});publish();}else{clearTimeout(timer);timer=null;}
  $('phone-network').hidden=active||$('phone-network').options.length<2;$('phone-start').hidden=active;$('phone-stop').hidden=!active;$('phone-pairing').hidden=!active;
  $('phone-status').textContent=active?(value.clients?'iPhone connecté':'Scannez avec l’appareil photo de l’iPhone.'):'Même Wi-Fi · Clair reste ouvert sur l’ordinateur.';
  if(!active){$('phone-qr').removeAttribute('src');$('phone-link').value='';}
 }
 async function display(value){status(value);if(value.active){$('phone-link').value=value.url;$('phone-qr').src=value.qr;}}
 $('phone-start').onclick=async()=>{if(busy)return;busy=true;$('phone-start').disabled=true;try{await display(await api.phoneStart($('phone-network').value));}catch(error){$('phone-status').textContent=error.message;}finally{busy=false;$('phone-start').disabled=false;}};
 $('phone-stop').onclick=async()=>{try{await api.phoneStop();}catch(error){$('phone-status').textContent=error.message;}};
 $('phone-copy').onclick=()=>api.copy($('phone-link').value).catch(error=>{$('phone-status').textContent=error.message;});
 $('phone-section').addEventListener('toggle',async()=>{if(!$('phone-section').open)return;try{const value=await api.phoneState();const selected=$('phone-network').value;$('phone-network').replaceChildren(...value.addresses.map(x=>{const option=document.createElement('option');option.value=x.address;option.textContent=x.name+' · '+x.address;return option;}));if(value.addresses.some(x=>x.address===selected))$('phone-network').value=selected;$('phone-network').hidden=value.addresses.length<2||value.active;await display(value);}catch(error){$('phone-status').textContent=error.message;}});
 api.onEvent(event=>{if(event.type==='phone-status')status(event);});
 await display(await api.phoneState());
}
