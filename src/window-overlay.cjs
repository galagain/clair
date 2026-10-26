// Native mouse routing. Screen polling also restores controls when Chromium
// receives no movement because the pointer arrived from another application.
function contains(rect,x,y){return x>=rect.x&&y>=rect.y&&x<rect.x+rect.width&&y<rect.y+rect.height;}
function validLayout(value){return value&&['session','files','settings'].includes(value.view)&&Number.isFinite(value.height)&&value.height>=0&&value.height<=100000&&Array.isArray(value.regions)&&value.regions.length<=200&&value.regions.every(r=>r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>=0&&r.height>=0&&Math.abs(r.x)<100000&&Math.abs(r.y)<100000&&r.width<100000&&r.height<100000);}
class WindowOverlay {
 constructor(win,screen){
  this.win=win;this.screen=screen;this.regions=null;this.ignored=null;this.manualSize=false;this.compact=false;this.held=false;this.view='session';this.height=null;
  this.timer=setInterval(()=>this.refresh(),16);this.timer.unref?.();
  win.on('resize',()=>{const [width,height]=win.getSize();if(!this.expected||width!==this.expected[0]||height!==this.expected[1])this.manualSize=true;this.refresh();});
  win.on('move',()=>this.refresh());win.on('blur',()=>{this.held=false;this.refresh();});
  win.on('closed',()=>this.dispose());
 }
 update(value){
  if(!validLayout(value))return false;
  const sameView=this.view===value.view,changed=this.height!==value.height;
  this.regions=value.regions;this.view=value.view;this.height=value.height;
  if(this.view==='session'&&sameView&&changed&&!this.manualSize&&!this.held)this.fit();
  this.refresh();return true;
 }
 fit(){
  const bounds=this.win.getBounds(),area=this.screen.getDisplayMatching(bounds).workArea;
  const available=Math.max(180,area.y+area.height-bounds.y);
  const height=Math.max(180,Math.min(Math.ceil(this.height||300),this.compact?320:600,available));
  this.resize(bounds.width,height);
 }
 resize(width,height){this.expected=[width,height];if(this.win.getSize().some((n,i)=>n!==this.expected[i]))this.win.setSize(width,height);}
 preset(compact){this.compact=!!compact;this.manualSize=false;this.resize(compact?360:400,Math.min(this.height||300,compact?320:600));}
 hold(value){if(typeof value!=='boolean')return;this.held=value;this.refresh();}
 refresh(){
  if(this.win.isDestroyed()||!this.regions)return;
  const bounds=this.win.getContentBounds(),point=this.screen.getCursorScreenPoint(),x=point.x-bounds.x,y=point.y-bounds.y;
  // Keep a small native resize corner, not an invisible border around the app.
  const corner=contains({x:bounds.width-10,y:bounds.height-10,width:10,height:10},x,y);
  const ignore=!(this.held||corner||this.regions.some(r=>contains(r,x,y)));
  if(ignore!==this.ignored){this.win.setIgnoreMouseEvents(ignore,{forward:true});this.ignored=ignore;}
 }
 reset(){this.regions=null;this.held=false;this.ignored=false;if(!this.win.isDestroyed())this.win.setIgnoreMouseEvents(false);}
 dispose(){clearInterval(this.timer);}
}
module.exports={WindowOverlay,contains,validLayout};
