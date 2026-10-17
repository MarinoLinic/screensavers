import * as T from '../vendor/three.module.min.js';
export class View {
  constructor(camera,canvas,onSplash,onChange) {
    this.camera=camera;this.canvas=canvas;this.onChange=onChange;this.manual=false;this.pointer=null;this.dirty=true;
    this.ray=new T.Raycaster();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.hit=new T.Vector3();
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0||this.pointer!==null)return;
      this.pointer=e.pointerId;this.x=this.startX=e.clientX;this.y=this.startY=e.clientY;this.moved=false;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove',e=>{
      if(e.pointerId!==this.pointer)return;
      const dx=e.clientX-this.x,dy=e.clientY-this.y;this.x=e.clientX;this.y=e.clientY;
      if(Math.hypot(e.clientX-this.startX,e.clientY-this.startY)>4)this.moved=true;
      if(this.moved){this.manual=true;this.yaw=T.MathUtils.clamp(this.yaw-dx*.004,this.homeYaw-.9,this.homeYaw+.9);this.pitch=T.MathUtils.clamp(this.pitch+dy*.003,.14,.8);this.dirty=true;onChange();}
    });
    const end=e=>{
      if(e.pointerId!==this.pointer)return;
      if(e.type==='pointerup'&&!this.moved){
        const r=canvas.getBoundingClientRect();this.ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
        if(this.ray.ray.intersectPlane(this.plane,this.hit))onSplash(this.hit.x,this.hit.z);
      }
      this.pointer=null;
    };
    for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,end);
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.manual=true;this.zoom=T.MathUtils.clamp(this.zoom*Math.exp(e.deltaY*.0007),.65,1.6);this.dirty=true;onChange();},{passive:false});
    canvas.addEventListener('dblclick',()=>{this.reset();onChange();});
  }
  setHome({position,target,maxRadius=Infinity,maxHeight=Infinity}) {
    this.maxRadius=maxRadius;this.maxHeight=maxHeight;
    this.target=new T.Vector3(...target);const d=new T.Vector3(...position).sub(this.target);
    this.distance=d.length();this.homeYaw=Math.atan2(d.x,d.z);this.homePitch=Math.asin(d.y/this.distance);this.reset();
  }
  reset(){this.yaw=this.homeYaw;this.pitch=this.homePitch;this.zoom=1;this.manual=false;this.dirty=true;}
  update(time,drift,aspect) {
    const moving=drift&&!this.manual&&this.pointer===null;
    if(!moving&&!this.dirty)return false;
    let yaw=this.yaw,pitch=this.pitch;
    if(moving){yaw+=Math.sin(time*.055)*.15;pitch+=Math.sin(time*.042)*.025;}
    // Preserve the horizontal composition in portrait without stretching the world.
    const portrait=Math.min(1.65,Math.max(1,Math.sqrt(1.2/aspect)));
    const d=this.distance*this.zoom*portrait,cp=Math.cos(pitch);
    this.camera.position.set(this.target.x+Math.sin(yaw)*cp*d,this.target.y+Math.sin(pitch)*d,this.target.z+Math.cos(yaw)*cp*d);
    const radius=Math.hypot(this.camera.position.x,this.camera.position.z);
    if(radius>this.maxRadius){this.camera.position.x*=this.maxRadius/radius;this.camera.position.z*=this.maxRadius/radius;}
    this.camera.position.y=Math.min(this.maxHeight,this.camera.position.y);
    this.camera.lookAt(this.target);this.camera.updateMatrixWorld();this.dirty=false;return true;
  }
}
