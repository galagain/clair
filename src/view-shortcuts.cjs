const VIEW_SHORTCUTS={F1:'interview',F2:'coding'};
function registerViewShortcuts(shortcuts,emit){
 const registered={};
 for(const [key,mode] of Object.entries(VIEW_SHORTCUTS))registered[key]=shortcuts.register(key,()=>emit({type:'view-shortcut',mode}));
 return registered;
}
module.exports={registerViewShortcuts,VIEW_SHORTCUTS};
