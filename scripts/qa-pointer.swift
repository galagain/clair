import ApplicationServices
import Foundation
let args=CommandLine.arguments
if !AXIsProcessTrusted(){fputs("Mouse automation not authorized\n",stderr);exit(2)}
func mouse(_ kind:CGEventType,_ x:Double,_ y:Double){CGEvent(mouseEventSource:nil,mouseType:kind,mouseCursorPosition:CGPoint(x:x,y:y),mouseButton:.left)?.post(tap:.cghidEventTap)}
if args[1]=="escape"{CGEvent(keyboardEventSource:nil,virtualKey:53,keyDown:true)?.post(tap:.cghidEventTap);CGEvent(keyboardEventSource:nil,virtualKey:53,keyDown:false)?.post(tap:.cghidEventTap);Thread.sleep(forTimeInterval:0.15);exit(0)}
let x=Double(args[2])!,y=Double(args[3])!
mouse(.mouseMoved,x,y);Thread.sleep(forTimeInterval:0.12)
if args[1]=="click"{mouse(.leftMouseDown,x,y);Thread.sleep(forTimeInterval:0.04);mouse(.leftMouseUp,x,y)}
if args[1]=="drag"{mouse(.leftMouseDown,x,y);Thread.sleep(forTimeInterval:0.08);let endX=Double(args[4])!,endY=Double(args[5])!;for step in 1...10{mouse(.leftMouseDragged,x+(endX-x)*Double(step)/10,y+(endY-y)*Double(step)/10);Thread.sleep(forTimeInterval:0.025)};mouse(.leftMouseUp,endX,endY)}
Thread.sleep(forTimeInterval:0.15)
