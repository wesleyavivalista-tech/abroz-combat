/** Constant-space timing totals, reset once per health-log interval. No fighter data. */
export class StepMetrics {
 private count=0;private total=0;private maximum=0;
 observe(ms:number):void{this.count++;this.total+=ms;this.maximum=Math.max(this.maximum,ms);}
 snapshot(){return {simulationSteps:this.count,simulationStepMeanMs:this.count?this.total/this.count:0,simulationStepMaxMs:this.maximum};}
 reset():void{this.count=0;this.total=0;this.maximum=0;}
}
export const stepMetrics=new StepMetrics();
