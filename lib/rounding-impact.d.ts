export type RoundingDay = {
  date:string; schedule:string; confirmed:boolean; working:boolean|null;
  balanceEligible:boolean; balanceHours:number; workedMinutes:number; balanceReason?:string;
  nightEligible:boolean; nightMinutes:number; nightHours:number; nightReason?:string;
};
export type RoundingInput = {
  year:number; profile:{turn:string;percent:number;subturn?:string|null}; fullTimeHours:number; workdays:number;
  balanceMode?:"daily-balance"|"recognized-hours";companyBasisHours?:number;
  examples:(RoundingDay & {label:string})[]; days:RoundingDay[];
};
export type RoundedMetric={exact:number;company:number;seconds:number};
export type RoundedDay={date:string;schedule:string;balance:RoundedMetric|null;night:RoundedMetric|null;balanceReason:string;nightReason:string};
export type RoundingTotal={count:number;excluded:number;exact:number|null;company:number|null;seconds:number|null};
export type RoundingReport={ready:false;reason:string}|{ready:true;annualHours:number;meanHours:number;workdays:number;
  examples:(RoundedDay & {label:string})[];missing:number;excludedWork:number;unknownDays:number;
  forecast:{balance:RoundingTotal;night:RoundingTotal};actual:{balance:RoundingTotal;night:RoundingTotal};days:RoundedDay[];forecastDays:RoundedDay[];
  missingActual:number;unknownActual:number;provisionalWork:number};
export const ROUNDING_PERCENTAGES:readonly number[];
export function roundingAvailable(input:RoundingInput|null|undefined):boolean;
export function roundingDay(row:RoundingDay,meanHours:number):RoundedDay;
export function dateInMadrid(now?:Date):string;
export function roundingPeriodEnd(year:number,today:string):string;
export function roundingReport(input:RoundingInput|null,{from,to,asOf}:{from:string;to:string;asOf:string}):RoundingReport;
export function signedRoundingTime(seconds:number|null|undefined):string;

