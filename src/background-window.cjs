const BACKGROUND_ACCELERATOR='CommandOrControl+Shift+H';
function registerBackgroundWindow(win,shortcuts){
 const toggle=()=>{
  if(win.isDestroyed())return false;
  if(win.isVisible()&&!win.isMinimized()){win.hide();return true;}
  if(win.isMinimized())win.restore();win.show();return false;
 };
 const registered=shortcuts.register(BACKGROUND_ACCELERATOR,toggle);
 return {toggle,registered,accelerator:BACKGROUND_ACCELERATOR};
}
module.exports={registerBackgroundWindow,BACKGROUND_ACCELERATOR};
