// Source attribution, not voice identification. Never infer individual remote
// speakers. Overlap or missing level metadata stays unassigned.
export class SourceTurns {
 constructor(threshold=.012){this.threshold=threshold;this.reset();}
 reset(){this.microphone=0;this.system=0;this.overlap=0;}
 source(levels){if(!levels)return null;const mic=levels.micRms>=this.threshold,system=levels.systemRms>=this.threshold;return mic&&!system?'microphone':system&&!mic?'system':null;}
 add(levels,ms){const source=this.source(levels);if(source)this[source]+=ms;else if(levels?.micRms>=this.threshold&&levels?.systemRms>=this.threshold)this.overlap+=ms;}
 speaker(){const total=this.microphone+this.system+this.overlap;if(!total)return null;for(const source of ['microphone','system'])if(this[source]>=200&&this[source]/total>=.8)return source;return null;}
}
