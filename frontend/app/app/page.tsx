"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Design System ────────────────────────────────────────────────────────────
// Zinc × Electric Indigo × Teal — surgical Apple-level precision
const DS = {
  // Zinc — darkened for contrast over sun image
  z0:   "#FFFFFF",
  z50:  "#FAFAFA",
  z100: "#F4F4F5",
  z150: "#ECECEE",
  z200: "#E4E4E7",
  z300: "#D4D4D8",
  z400: "#71717A",   // was #A1A1AA — bumped 2 stops darker
  z500: "#52525B",   // was #71717A — bumped 2 stops darker
  z600: "#3F3F46",   // was #52525B
  z700: "#27272A",   // was #3F3F46
  z800: "#18181B",   // was #27272A
  z900: "#09090B",   // was #18181B

  // Electric Indigo
  i50:  "#EEF2FF",
  i100: "#E0E7FF",
  i200: "#C7D2FE",
  i400: "#818CF8",
  i500: "#6366F1",
  i600: "#4F46E5",
  i700: "#4338CA",

  // Teal
  t50:  "#F0FDFA",
  t100: "#CCFBF1",
  t400: "#2DD4BF",
  t500: "#14B8A6",
  t600: "#0D9488",
  t700: "#0F766E",

  // Semantic
  amber:   "#F59E0B",
  amberBg: "#FFFBEB",
  red:     "#EF4444",
  redBg:   "#FFF1F2",
  emerald: "#10B981",
  violet:  "#8B5CF6",
  violetBg:"#F5F3FF",

  // Glass — higher opacity for contrast over sunrise
  glass:      "rgba(255,255,255,0.85)",
  glassDim:   "rgba(255,255,255,0.72)",
  glassBorder:"rgba(255,255,255,0.90)",
  rim:        "rgba(228,228,231,0.70)",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface TimeModel { day_start_hour:number; day_end_hour:number; slot_minutes:number; slots_per_day:number; training_window_days:number; start_date?:string; }
interface Placement { id:string; employee_id:string; course_id:string; day_index:number; start_slot:number; duration_slots:number; overflow:boolean; room?:number; }
interface Node { id:string; type:string; label:string; shift_name?:string; shift_hours?:string; shift_days?:string; }
interface Metrics { score:number; compression_percent:number; remaining_hours:number; estimated_manual_hours?:number; solver?:string; overflow_count?:number; total_placements?:number; scheduled_placements?:number; }
interface SolveMetadata { status:string; is_optimal:boolean; is_feasible:boolean; elapsed_seconds:number; time_limit_seconds:number; gap_percent:number|null; solutions_found:number; solver_label:string; }
interface Complexity { estimated_seconds:number; complexity_score:number; complexity_label:string; confidence:string; suggest_deep_solve:boolean; drivers:Record<string,number>; }
interface Snapshot { nodes:Node[]; constraints:unknown[]; placements:Placement[]; metrics:Metrics; phase:"planned"|"optimized"; time_model:TimeModel; solve_metadata?:SolveMetadata; }
interface Simulation { simulation_id:string; status:string; snapshot:Snapshot; complexity?:Complexity; }
interface GridCell { employeeIds:string[]; empCourse:Record<string,string>; items:Placement[]; }
interface Projection { grid:GridCell[][]; roomGrids:[GridCell[][],GridCell[][]]; maxEmpPerCell:number; maxEmpPerLane:number; overflowCount:number; days:number; groups:number; nodeMap:Record<string,Node>; empToCells:Record<string,string[]>; empPlacements:Record<string,Placement[]>; }
type Status = "idle"|"generating"|"generated"|"solving"|"solved"|"error";
interface Tooltip { empId:string; name:string; courseName:string; durationH:number; x:number; y:number; }

const API  = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SOLVE_LIMIT_S      = 30;   // fast initial solve time limit
const DEEP_SOLVE_LIMIT_S = 300;  // deep solve (user opt-in) time limit
const SOLVER_MESSAGES = [
  "Initialising constraint model…",
  "Mapping employee-to-course relationships…",
  "Building interval variables for each session…",
  "Applying room capacity constraints…",
  "Enforcing weekend exclusions…",
  "Running CP-SAT branch-and-bound search…",
  "Pruning infeasible sub-trees…",
  "Exploring promising solution paths…",
  "Tightening objective bounds…",
  "Converging on optimal assignment…",
  "Verifying constraint satisfaction…",
  "Finalising schedule…",
];
const CW   = 44;   // cell width px
const SPG  = 4;    // slots per hour group
const YM   = 54;   // y-axis margin
const XAH  = 38;   // x-axis header height

// ─── Utilities ────────────────────────────────────────────────────────────────
const toIso = (d:Date) => d.toISOString().slice(0,10);
function addDays(s:string,n:number){ const d=new Date(s); d.setDate(d.getDate()+n); return toIso(d); }
function addMonths(s:string,n:number){ const d=new Date(s); d.setMonth(d.getMonth()+n); return toIso(d); }
function daysBetween(a:string,b:string){ return Math.round((new Date(b).getTime()-new Date(a).getTime())/86400000); }
function fmtShort(s:string){ return new Date(s).toLocaleDateString("en-NZ",{weekday:"short",day:"numeric",month:"short"}); }
function fmtLong(s:string){ return new Date(s).toLocaleDateString("en-NZ",{weekday:"short",day:"numeric",month:"short",year:"numeric"}); }
function dowOf(s:string){ return new Date(s).getDay(); }
function fmtElapsed(ms:number){ if(ms<1000)return`${ms}ms`; const s=ms/1000; if(s<60)return`${s.toFixed(1)}s`; return`${Math.floor(s/60)}m${Math.round(s%60)}s`; }
function fmtHours(h:number){ if(!h)return"0h"; if(h<8)return`${h.toFixed(1)}h`; const d=h/8; if(d<5)return`${d.toFixed(1)}d`; return`${(d/5).toFixed(1)}w`; }
function fmtHoursParts(h:number):{v:string;u:string}{ if(!h)return{v:"0",u:"h"}; if(h<8)return{v:h.toFixed(1),u:"h"}; const d=h/8; if(d<5)return{v:d.toFixed(1),u:"d"}; return{v:(d/5).toFixed(1),u:"w"}; }
const DOW = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// ─── Projection ───────────────────────────────────────────────────────────────
function buildProjection(snap:Snapshot):Projection {
  const {time_model:tm,placements,nodes}=snap;
  const groups=Math.ceil(tm.slots_per_day/SPG), days=tm.training_window_days;
  const mkGrid=()=>Array.from({length:days},()=>Array.from({length:groups},()=>({employeeIds:[] as string[],empCourse:{} as Record<string,string>,items:[] as Placement[]})));
  const grid=mkGrid();
  const roomGrids:[GridCell[][],GridCell[][]]=[mkGrid(),mkGrid()];
  const nodeMap:Record<string,Node>={};
  for(const n of nodes) nodeMap[n.id]=n;
  const empToCells:Record<string,string[]>={}, empPlacements:Record<string,Placement[]>={};
  let overflowCount=0;
  for(const p of placements){
    if(!empPlacements[p.employee_id]) empPlacements[p.employee_id]=[];
    empPlacements[p.employee_id].push(p);
    if(p.overflow){overflowCount++;continue;}
    if(p.day_index<0||p.day_index>=days) continue;
    const gS=Math.floor(p.start_slot/SPG), gE=Math.min(Math.floor((p.start_slot+p.duration_slots-1)/SPG),groups-1);
    const room=p.room??0;
    for(let g=gS;g<=gE;g++){
      // Combined grid (for planned view + focus rings)
      const cell=grid[p.day_index][g];
      if(!cell.employeeIds.includes(p.employee_id)){cell.employeeIds.push(p.employee_id);cell.empCourse[p.employee_id]=p.course_id;}
      cell.items.push(p);
      // Room-specific grid (for optimized split-lane view)
      const rc=roomGrids[room][p.day_index][g];
      if(!rc.employeeIds.includes(p.employee_id)){rc.employeeIds.push(p.employee_id);rc.empCourse[p.employee_id]=p.course_id;}
      rc.items.push(p);
      const k=`${p.day_index},${g}`;
      if(!empToCells[p.employee_id]) empToCells[p.employee_id]=[];
      if(!empToCells[p.employee_id].includes(k)) empToCells[p.employee_id].push(k);
    }
  }
  let maxEmpPerCell=1, maxEmpPerLane=1;
  for(const row of grid) for(const c of row) if(c.employeeIds.length>maxEmpPerCell) maxEmpPerCell=c.employeeIds.length;
  for(const rg of roomGrids) for(const row of rg) for(const c of row) if(c.employeeIds.length>maxEmpPerLane) maxEmpPerLane=c.employeeIds.length;
  return {grid,roomGrids,maxEmpPerCell,maxEmpPerLane,overflowCount,days,groups,nodeMap,empToCells,empPlacements};
}

// ─── Weekend filter (frontend enforcement) ────────────────────────────────────
// Backend doesn't yet understand weekend restrictions, so we mark those placements
// as overflow client-side before building the projection.
function filterWeekendPlacements(snap:Snapshot, allowSat:boolean, allowSun:boolean):Snapshot {
  if(allowSat&&allowSun) return snap;
  if(!snap.time_model.start_date) return snap;
  const placements=snap.placements.map(p=>{
    if(p.overflow) return p;
    const iso=addDays(snap.time_model.start_date!,p.day_index);
    const dow=dowOf(iso);
    const blocked=(dow===6&&!allowSat)||(dow===0&&!allowSun);
    return blocked?{...p,overflow:true}:p;
  });
  return{...snap,placements};
}

// ─── Shift pattern definitions ───────────────────────────────────────────────
const SHIFT_DEFS = [
  {
    id: "core4on4off",
    name: "Core Production",
    shortName: "4-on 4-off",
    category: "Core Production (dryers, UHT, whey)",
    description: "12h rotating days/nights. 16-day cycle: 4 days → 4 off → 4 nights → 4 off.",
    daysLabel: "All 7 days rotating",
    hoursPerShift: 12,
    cycleLength: 16,
    teams: "A/B/C/D",
    always: true,  // always active, cannot be deselected
  },
  {
    id: "panama223",
    name: "Panama 2-2-3",
    shortName: "2-2-3 Panama",
    category: "Packaging / Warehouse / Lab",
    description: "12h schedule. 14-day cycle: 2 on, 2 off, 3 on, 2 off, 2 on, 3 off. More frequent weekends off.",
    daysLabel: "All 7 days rotating",
    hoursPerShift: 12,
    cycleLength: 14,
    teams: "A/B/C/D",
    always: false,
  },
  {
    id: "standard52",
    name: "Standard 5:2 + On-call",
    shortName: "5:2 + On-call",
    category: "Maintenance / Utilities / Support",
    description: "Mon–Fri 07:00–15:30 day shifts. Small 4-team 4-on 4-off 12h crew covers nights/weekends.",
    daysLabel: "M T W T F (+ on-call crew)",
    hoursPerShift: 8.5,
    cycleLength: 7,
    teams: "Core + On-call",
    always: false,
  },
] as const;
type ShiftId = "core4on4off"|"panama223"|"standard52";
function rr(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
  const R=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+R,y); ctx.lineTo(x+w-R,y); ctx.arcTo(x+w,y,x+w,y+R,R);
  ctx.lineTo(x+w,y+h-R); ctx.arcTo(x+w,y+h,x+w-R,y+h,R);
  ctx.lineTo(x+R,y+h); ctx.arcTo(x,y+h,x,y+h-R,R);
  ctx.lineTo(x,y+R); ctx.arcTo(x,y,x+R,y,R);
  ctx.closePath();
}

// ─── Canvas render ────────────────────────────────────────────────────────────
// Room colour palette
const ROOM_COLORS=[
  {fill:"rgba(13,148,136,0.14)",fillFaint:"rgba(13,148,136,0.05)",rim:DS.t500,rimFocus:DS.t400,dot:DS.t500},   // Room 0 — teal
  {fill:"rgba(124,58,237,0.13)",fillFaint:"rgba(124,58,237,0.04)",rim:"#7C3AED",rimFocus:"#8B5CF6",dot:"#7C3AED"},// Room 1 — violet
];

function drawCanvas(
  canvas:HTMLCanvasElement, proj:Projection, snap:Snapshot,
  containerH:number, hovEmp:string|null,
  selCell:{day:number;group:number;room?:number}|null, selEmp:string|null,
  anim:number,
  allowSat:boolean, allowSun:boolean,
  cw:number,
  numTrainers:1|2
):number {
  const tm=snap.time_model;
  const {grid,roomGrids,maxEmpPerLane,days,groups}=proj;
  const CH=Math.max(Math.round(46*(cw/44)),Math.floor(containerH/groups));
  const isOpt=snap.phase==="optimized";
  const useTwoLanes=isOpt&&numTrainers===2;
  const laneW=useTwoLanes?Math.max(11,Math.floor(cw/2)):cw;
  const numLanes=useTwoLanes?2:1;

  const dpr=typeof window!=="undefined"?(window.devicePixelRatio||1):1;
  const logW=YM+days*cw, logH=groups*CH;
  canvas.width=logW*dpr; canvas.height=logH*dpr;
  canvas.style.width=`${logW}px`; canvas.style.height=`${logH}px`;

  const ctx=canvas.getContext("2d")!;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,logW,logH);
  ctx.fillStyle="rgba(252,250,247,0.28)"; ctx.fillRect(0,0,logW,logH);

  const focusId=hovEmp??selEmp;
  const P=2;
  const micro=Math.max(3,Math.min(11,Math.floor(Math.sqrt((laneW-P*2-4)*(CH-P*2-4)/Math.max(maxEmpPerLane,1)))));
  const gap=1, stride=micro+gap;
  const cols=Math.max(1,Math.floor((laneW-P*2-4)/stride));

  // ── Draw cells per room lane ──────────────────────────────────────────────
  for(let room=0;room<numLanes;room++){
    const rc=ROOM_COLORS[room];
    const srcGrid=useTwoLanes?roomGrids[room]:grid;

    for(let d=0;d<days;d++){
      for(let g=0;g<groups;g++){
        const cell=srcGrid[d][g];
        const cx=YM+d*cw+(useTwoLanes?room*laneW:0);
        const cy=g*CH;
        const emp=cell.employeeIds.length;
        const hasFocus=focusId?cell.empCourse[focusId]!==undefined:false;
        const dimmed=!!focusId&&!hasFocus;
        const spansContinues=cell.items.some(p=>p.start_slot+p.duration_slots>(g+1)*SPG);
        const uniqueCourses=new Set(cell.items.map(p=>p.course_id));
        const multiCourse=uniqueCourses.size>1&&!isOpt; // only flag in planned

        if(emp>0){
          ctx.globalAlpha=(dimmed?0.22:0.90)*anim;
          ctx.fillStyle=hasFocus||!focusId?rc.fill:rc.fillFaint;
          rr(ctx,cx+P,cy+P,laneW-P*2,CH-P*2,5); ctx.fill();

          ctx.globalAlpha=(dimmed?0.04:0.28)*anim;
          ctx.fillStyle="rgba(255,255,255,0.9)";
          rr(ctx,cx+P,cy+P,laneW-P*2,4,3); ctx.fill();

          ctx.globalAlpha=(dimmed?0.10:0.28)*anim;
          ctx.strokeStyle=multiCourse?"#F59E0B":rc.rim;
          ctx.lineWidth=multiCourse?1.2:0.75;
          rr(ctx,cx+P,cy+P,laneW-P*2,CH-P*2,5); ctx.stroke();
          ctx.globalAlpha=1;

          if(multiCourse){
            ctx.globalAlpha=0.85*anim;
            ctx.fillStyle="#F59E0B";
            ctx.beginPath(); ctx.arc(cx+laneW-P-4,cy+P+4,3,0,Math.PI*2); ctx.fill();
            ctx.globalAlpha=1;
          }

          if(spansContinues&&g<groups-1){
            ctx.globalAlpha=0.75*anim;
            ctx.strokeStyle=rc.rimFocus; ctx.lineWidth=1.2;
            const mx=cx+laneW/2, my=cy+CH-3;
            ctx.beginPath(); ctx.moveTo(mx-4,my-4); ctx.lineTo(mx,my); ctx.lineTo(mx+4,my-4); ctx.stroke();
            ctx.fillStyle=rc.fill.replace("0.14","0.30").replace("0.13","0.28");
            ctx.fillRect(cx+P,cy+P,2.5,CH-P*2);
            ctx.globalAlpha=1;
          }
          const spansContinuedFrom=g>0&&srcGrid[d][g-1].items.some(p=>p.start_slot+p.duration_slots>(g)*SPG&&cell.items.some(pp=>pp.employee_id===p.employee_id&&pp.course_id===p.course_id));
          if(spansContinuedFrom){
            ctx.globalAlpha=0.40*anim;
            ctx.fillStyle=rc.fill.replace("0.14","0.25").replace("0.13","0.22");
            ctx.fillRect(cx+P,cy+P,2.5,CH-P*2);
            ctx.globalAlpha=1;
          }
        }

        // Micro-dots
        for(let i=0;i<emp;i++){
          const eid=cell.employeeIds[i];
          const col=i%cols, row2=Math.floor(i/cols);
          const mx=cx+P+2+col*stride, my=cy+P+2+row2*stride;
          if(mx+micro>cx+laneW-P-2||my+micro>cy+CH-P-2) break;
          const focused=eid===focusId;
          ctx.globalAlpha=(focusId?(focused?1:0.09):0.7)*anim;
          ctx.fillStyle=focused?DS.amber:rc.dot;
          rr(ctx,mx,my,micro,micro,2); ctx.fill();
        }
        ctx.globalAlpha=1;
      }
    }
  }

  // ── Weekend shading ──────────────────────────────────────────────────────
  if(tm.start_date){
    for(let d=0;d<days;d++){
      const dow=dowOf(addDays(tm.start_date,d));
      const isSat=dow===6, isSun=dow===0;
      if(isSat||isSun){
        const disabled=(isSat&&!allowSat)||(isSun&&!allowSun);
        if(disabled){
          ctx.fillStyle="rgba(160,160,175,0.18)";
          ctx.fillRect(YM+d*cw,0,cw,logH);
          ctx.save();
          ctx.strokeStyle="rgba(160,160,175,0.20)"; ctx.lineWidth=1;
          for(let y=-logH;y<logH*2;y+=9){ctx.beginPath();ctx.moveTo(YM+d*cw,y);ctx.lineTo(YM+d*cw+cw,y+cw);ctx.stroke();}
          ctx.restore();
          ctx.fillStyle="rgba(140,140,155,0.30)";
          ctx.fillRect(YM+d*cw,0,cw,2);
        } else {
          ctx.fillStyle="rgba(99,102,241,0.028)";
          ctx.fillRect(YM+d*cw,0,cw,logH);
          ctx.fillStyle="rgba(99,102,241,0.14)";
          ctx.fillRect(YM+d*cw,0,2,logH);
        }
      }
    }
  }

  // ── Grid lines ───────────────────────────────────────────────────────────
  ctx.strokeStyle="rgba(228,228,231,0.45)"; ctx.lineWidth=0.5;
  for(let g=0;g<=groups;g++){ctx.beginPath();ctx.moveTo(YM,g*CH);ctx.lineTo(logW,g*CH);ctx.stroke();}

  ctx.strokeStyle="rgba(210,210,220,0.25)"; ctx.lineWidth=0.5;
  for(let d=1;d<days;d++){ctx.beginPath();ctx.moveTo(YM+d*cw,0);ctx.lineTo(YM+d*cw,logH);ctx.stroke();}

  ctx.strokeStyle="rgba(196,196,204,0.45)"; ctx.lineWidth=1;
  for(let d=7;d<days;d+=7){ctx.beginPath();ctx.moveTo(YM+d*cw,0);ctx.lineTo(YM+d*cw,logH);ctx.stroke();}

  // ── Room divider (dashed midline inside each day column when optimized) ──
  if(useTwoLanes){
    ctx.save();
    ctx.setLineDash([2,3]);
    ctx.strokeStyle="rgba(160,155,180,0.40)"; ctx.lineWidth=0.75;
    for(let d=0;d<days;d++){
      const x=YM+d*cw+laneW;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,logH); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── Y-axis ───────────────────────────────────────────────────────────────
  ctx.font=`600 11px 'Geist Mono',monospace`;
  ctx.fillStyle=DS.z500; ctx.textAlign="right"; ctx.textBaseline="middle";
  for(let g=0;g<groups;g++){ctx.fillText(`${String(tm.day_start_hour+g).padStart(2,"0")}:00`,YM-6,g*CH+CH/2);}
  ctx.strokeStyle="rgba(228,228,231,0.7)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(YM,0); ctx.lineTo(YM,logH); ctx.stroke();

  // ── Selection ring ───────────────────────────────────────────────────────
  if(selCell){
    const {day,group,room:selRoom=0}=selCell;
    if(day>=0&&day<days&&group>=0&&group<groups){
      const cx_s=YM+day*cw+(useTwoLanes?selRoom*laneW:0);
      const w_s=laneW;
      ctx.save();
      ctx.shadowBlur=10; ctx.shadowColor=`${DS.i500}50`;
      ctx.strokeStyle=DS.i500; ctx.lineWidth=1.5;
      rr(ctx,cx_s+P,group*CH+P,w_s-P*2,CH-P*2,5); ctx.stroke();
      ctx.restore();
    }
  }

  // ── Focus-employee amber rings ───────────────────────────────────────────
  if(focusId&&proj.empToCells[focusId]){
    ctx.save();
    ctx.shadowBlur=8; ctx.shadowColor=`${DS.amber}55`;
    ctx.strokeStyle=DS.amber; ctx.lineWidth=1.5;
    for(const k of proj.empToCells[focusId]){
      const [ds,gs]=k.split(",").map(Number);
      rr(ctx,YM+ds*cw+P,gs*CH+P,cw-P*2,CH-P*2,5); ctx.stroke();
    }
    ctx.restore();
  }

  return CH;
}


// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({data,color,w=52,h=20}:{data:number[];color:string;w?:number;h?:number}){
  if(data.length<2) return <svg width={w} height={h}/>;
  const mx=Math.max(...data), mn=Math.min(...data), rng=mx-mn||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/rng)*(h-2)-1}`).join(" ");
  return(
    <svg width={w} height={h} style={{overflow:"visible"}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Metric Tile ──────────────────────────────────────────────────────────────
function MetricTile({label,display,unit,sub,spark,color,accent,tooltip,flash,onClick,progress}:{
  label:string; display:string|number; unit?:string; sub?:string;
  spark?:number[]; color:string; accent:string; tooltip?:string;
  flash?:boolean; onClick?:()=>void;
  progress?:number; // 0–1, shows a progress bar when present (Solve Time tile)
}){
  const [hov,setHov]=useState(false);
  return(
    <div style={{
      flex:1, minWidth:0, position:"relative",
      background:"rgba(255,255,255,0.55)",
      backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
      border:`1px solid rgba(255,255,255,0.75)`,
      borderRadius:14,
      padding:"9px 12px 8px",
      boxShadow:`0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.8) inset, 0 2px 0 ${accent}18`,
      display:"flex", flexDirection:"column", justifyContent:"space-between",
      cursor:onClick?"pointer":tooltip?"help":"default",
      transition:"background 0.15s",
      animation:flash?"score-flash 2.8s ease forwards":"none",
      minHeight:92,height:92,
    }}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      onClick={onClick}
    >
      {/* Label row — fixed 2-line height so numbers always align */}
      <div style={{
        fontFamily:"'Geist Mono',monospace", fontSize:8.5, fontWeight:500,
        color, letterSpacing:"0.09em", textTransform:"uppercase",
        lineHeight:1.35, minHeight:24, display:"flex", alignItems:"flex-start",
      }}>{label}</div>

      {/* Number row — always at same vertical position */}
      <div style={{display:"flex",alignItems:"baseline",gap:0,marginTop:2}}>
        {/* Number in fixed tabular font so width doesn't wiggle */}
        <span style={{
          fontFamily:"'Geist Mono',monospace", fontSize:28, fontWeight:700,
          color:DS.z900, letterSpacing:"-0.02em", lineHeight:1,
          fontVariantNumeric:"tabular-nums",
          animation:flash?"score-flash-text 2.8s ease forwards":"none",
        }}>{display}</span>
        {/* Unit — fixed-width span so it never shifts */}
        {unit&&<span style={{
          fontFamily:"'Geist Mono',monospace",fontSize:13,color,fontWeight:600,
          marginLeft:2,lineHeight:1,alignSelf:"flex-end",marginBottom:2,
          display:"inline-block",minWidth:16,
        }}>{unit}</span>}
      </div>

      {/* Fixed-height bottom zone: progress bar (if present) + sub-label */}
      <div style={{minHeight:24,display:"flex",flexDirection:"column",justifyContent:"flex-end",gap:2,marginTop:4}}>
        {progress!=null&&(
          <div style={{height:3,background:"rgba(0,0,0,0.08)",borderRadius:2,overflow:"hidden"}}>
            <div style={{
              height:"100%",
              width:`${Math.round(progress*100)}%`,
              background:`linear-gradient(90deg,${DS.i400},${DS.t400})`,
              borderRadius:2,
              transition:"width 0.1s linear",
            }}/>
          </div>
        )}
        {sub&&<div style={{fontFamily:"'Geist Mono',monospace",fontSize:7,color:DS.z400,lineHeight:1.45,
          display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{sub}</div>}
      </div>

      {/* Sparkline */}
      {spark&&spark.length>1&&(
        <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
          <Sparkline data={spark} color={accent} w={44} h={20}/>
        </div>
      )}

      {/* Tooltip */}
      {tooltip&&hov&&(
        <div style={{
          position:"absolute",top:"calc(100% + 8px)",left:0,zIndex:500,
          width:260,padding:"12px 14px",
          background:"rgba(15,12,35,0.97)",
          border:`1px solid ${DS.i400}44`,
          borderRadius:12,
          boxShadow:"0 12px 40px rgba(0,0,0,0.6)",
          pointerEvents:"none",
          animation:"wrs-fadein 0.15s ease",
        }}>
          <div style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:color,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",marginBottom:6}}>{label}</div>
          <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,color:"rgba(255,255,255,0.80)",lineHeight:1.65}}>{tooltip}</div>
        </div>
      )}
    </div>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────
function Accordion({title,icon,children,open:defaultOpen=false}:{title:string;icon:React.ReactNode;children:React.ReactNode;open?:boolean}){
  const [open,setOpen]=useState(defaultOpen);
  return(
    <div style={{marginBottom:2}}>
      <button
        onClick={()=>setOpen(p=>!p)}
        style={{
          width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"8px 10px", background:open?`${DS.i50}`:"transparent",
          border:`1px solid ${open?DS.i200:"transparent"}`,
          borderRadius:9, cursor:"pointer", transition:"all 0.18s ease",
        }}
      >
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <span style={{fontSize:14,lineHeight:1}}>{icon}</span>
          <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,fontWeight:600,color:DS.z700}}>{title}</span>
        </div>
        {/* UP when closed (collapsed), DOWN when open (expanded) */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{transform:open?"rotate(0deg)":"rotate(180deg)",transition:"transform 0.22s ease",flexShrink:0}}>
          <path d="M2 4.5L6 8.5L10 4.5" stroke={DS.z400} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <div style={{
        overflow:"hidden",
        maxHeight:open?"600px":"0px",
        transition:"max-height 0.28s cubic-bezier(0.4,0,0.2,1)",
        paddingLeft:4, paddingRight:4,
      }}>
        <div style={{padding:"10px 4px 6px"}}>{children}</div>
      </div>
    </div>
  );
}

// ─── Sidecar Slider ───────────────────────────────────────────────────────────
function SideSlider({label,field,min,max,step=1,value,unit="",onChange}:{
  label:string;field:string;min:number;max:number;step?:number;value:number;unit?:string;
  onChange:(f:string,v:number)=>void;
}){
  const pct=((value-min)/(max-min))*100;
  return(
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,color:DS.z600,fontWeight:500}}>{label}</span>
        <span style={{
          fontFamily:"'Geist Mono',monospace",fontSize:10,color:DS.i600,fontWeight:600,
          background:DS.i50,border:`1px solid ${DS.i100}`,padding:"1px 8px",borderRadius:20,
        }}>{value}{unit}</span>
      </div>
      <div style={{position:"relative",height:20,display:"flex",alignItems:"center"}}>
        <div style={{position:"absolute",left:0,right:0,height:3,background:DS.z200,borderRadius:2}}>
          <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${DS.i400},${DS.i500})`,borderRadius:2,transition:"width 0.1s"}}/>
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e=>onChange(field,step<1?parseFloat(e.target.value):parseInt(e.target.value))}
          style={{position:"relative",zIndex:1,width:"100%",WebkitAppearance:"none",appearance:"none",background:"transparent",cursor:"pointer",height:20}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:1}}>
        <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z300}}>{min}</span>
        <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z300}}>{max}</span>
      </div>
    </div>
  );
}

function SideDateInput({label,value,min,max,onChange}:{label:string;value:string;min:string;max:string;onChange:(v:string)=>void}){
  return(
    <div style={{marginBottom:12}}>
      <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,color:DS.z600,fontWeight:500,marginBottom:5}}>{label}</div>
      <input type="date" value={value} min={min} max={max} onChange={e=>onChange(e.target.value)}
        style={{
          width:"100%",padding:"7px 10px",
          background:"rgba(255,255,255,0.9)",
          border:`1px solid ${DS.z200}`,borderRadius:9,
          fontFamily:"'Geist Mono',monospace",fontSize:11,color:DS.z800,
          outline:"none",transition:"border-color 0.15s, box-shadow 0.15s",
        }}/>
    </div>
  );
}

function SideHourSelect({label,value,options,onChange}:{label:string;value:number;options:number[];onChange:(v:number)=>void}){
  return(
    <div style={{flex:1}}>
      <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,color:DS.z600,fontWeight:500,marginBottom:5}}>{label}</div>
      <select value={value} onChange={e=>onChange(parseInt(e.target.value))}
        style={{
          width:"100%",padding:"7px 8px",
          background:"rgba(255,255,255,0.9)",
          border:`1px solid ${DS.z200}`,borderRadius:9,
          fontFamily:"'Geist Mono',monospace",fontSize:11,color:DS.z800,
          outline:"none",cursor:"pointer",
        }}>
        {options.map(h=><option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>)}
      </select>
    </div>
  );
}

// ─── Inspector Card ───────────────────────────────────────────────────────────
function ICard({children,accent=DS.i500,style={}}:{children:React.ReactNode;accent?:string;style?:React.CSSProperties}){
  return(
    <div style={{
      background:"rgba(255,253,249,0.72)",
      backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",
      border:`1px solid rgba(255,255,255,0.70)`,
      borderRadius:16,padding:"14px 16px",
      boxShadow:`0 2px 20px rgba(120,80,20,0.08), 0 0 0 1px ${accent}12, 0 1px 0 rgba(255,255,255,0.9) inset`,
      animation:"wrs-spring 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      ...style,
    }}>{children}</div>
  );
}

function ILabel({children,color=DS.z400}:{children:React.ReactNode;color?:string}){
  return(
    <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,fontWeight:600,letterSpacing:"0.14em",color,textTransform:"uppercase",marginBottom:8}}>
      {children}
    </div>
  );
}

function IBadge({v,l,color,bg}:{v:string|number;l:string;color:string;bg:string}){
  return(
    <div style={{flex:1,background:bg,border:`1px solid ${color}22`,borderRadius:10,padding:"7px 10px",textAlign:"center"}}>
      <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:20,color,fontWeight:800,letterSpacing:"-0.03em",lineHeight:1}}>{v}</div>
      <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:9,color:DS.z500,marginTop:2,fontWeight:500}}>{l}</div>
    </div>
  );
}

// ─── Cell Inspector ───────────────────────────────────────────────────────────
function CellInspector({cell,data,tm,nodeMap,onClose,prof_max_classroom,phase,room,numTrainers}:{cell:{day:number;group:number;room:number};data:GridCell;tm:TimeModel;nodeMap:Record<string,Node>;onClose:()=>void;prof_max_classroom:number;phase:string;room:number;numTrainers:1|2}){
  const hr=tm.day_start_hour+cell.group;
  const iso=tm.start_date?addDays(tm.start_date,cell.day):"";
  const isOptimized=phase==="optimized";
  const showRoomBadge=isOptimized&&numTrainers===2;
  const roomColor=room===0?DS.t500:"#7C3AED";
  const roomBg=room===0?DS.t50:"rgba(237,233,254,0.7)";

  // Build per-course info: unique courses with their total duration and span (in hour groups)
  const courseInfo=new Map<string,{label:string;totalSlots:number;spanGroups:Set<number>;empCount:number}>();
  for(const p of data.items){
    const cid=p.course_id;
    if(!courseInfo.has(cid)) courseInfo.set(cid,{label:nodeMap[cid]?.label??cid,totalSlots:p.duration_slots,spanGroups:new Set(),empCount:0});
    const ci=courseInfo.get(cid)!;
    ci.totalSlots=p.duration_slots;
    const gS=Math.floor(p.start_slot/SPG), gE=Math.floor((p.start_slot+p.duration_slots-1)/SPG);
    for(let g=gS;g<=gE;g++) ci.spanGroups.add(g);
  }
  for(const [eid,cid] of Object.entries(data.empCourse)){
    if(courseInfo.has(cid)) courseInfo.get(cid)!.empCount++;
  }

  const courses=[...courseInfo.entries()];
  const multiCourse=courses.length>1;

  return(
    <ICard accent={multiCourse&&!isOptimized?DS.amber:isOptimized?roomColor:DS.i500}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
            <ILabel color={multiCourse&&!isOptimized?DS.amber:isOptimized?roomColor:DS.i500}>Hour Block</ILabel>
            {showRoomBadge&&(
              <div style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:6,background:roomBg,border:`1px solid ${roomColor}33`,flexShrink:0}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:roomColor}}/>
                <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:roomColor,fontWeight:700}}>
                  {room===0?"Room 1 · Trainer 1":"Room 2 · Trainer 2"}
                </span>
              </div>
            )}
          </div>
          <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:14,color:DS.z900,fontWeight:700,lineHeight:1.2}}>{iso?fmtLong(iso):`Day ${cell.day+1}`}</div>
          <div style={{fontFamily:"'Geist Mono',monospace",fontSize:10,color:DS.z600,marginTop:3}}>{String(hr).padStart(2,"0")}:00 – {String(hr+1).padStart(2,"0")}:00</div>
        </div>
        <button onClick={onClose} style={{width:26,height:26,borderRadius:8,background:DS.z100,border:`1px solid ${DS.z200}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:DS.z500,fontSize:15,fontWeight:700,flexShrink:0}}>×</button>
      </div>

      {/* Multi-course warning — planned only; optimized CP-SAT enforces single-course-per-room */}
      {multiCourse&&!isOptimized&&(
        <div style={{padding:"8px 10px",background:"rgba(255,246,220,0.85)",border:`1px solid ${DS.amber}55`,borderRadius:9,marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <span style={{fontSize:12}}>⚠</span>
            <span style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:"#92400E",fontWeight:700}}>
              {courses.length} courses in block — unoptimised placement
            </span>
          </div>
          <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:9,color:"#78350F",lineHeight:1.6}}>
            This is the <strong>planned</strong> (unoptimised) view. Overlapping courses are expected here. Run <em>Optimise Schedule</em> to enforce single-course-per-room via CP-SAT.
          </div>
        </div>
      )}

      {/* Oversized classroom warning — planned only */}
      {data.employeeIds.length>prof_max_classroom&&!isOptimized&&(
        <div style={{padding:"7px 10px",background:"rgba(238,242,255,0.85)",border:`1px solid ${DS.i400}44`,borderRadius:9,marginBottom:10}}>
          <div style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:DS.i700,fontWeight:700,marginBottom:3}}>
            ℹ {data.employeeIds.length} trainees — unoptimised
          </div>
          <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:9,color:DS.i600,lineHeight:1.6}}>
            Planned view shows all enrolled employees together. After optimisation, CP-SAT splits sessions to respect the {prof_max_classroom}-seat classroom limit.
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:5,marginBottom:10}}>
        <IBadge v={data.employeeIds.length} l="trainees" color={DS.i600} bg={DS.i50}/>
        <IBadge v={courses.length} l="courses" color={multiCourse?DS.amber:DS.t600} bg={multiCourse?DS.amberBg:DS.t50}/>
        <IBadge v={data.items.length} l="bookings" color={DS.violet} bg={DS.violetBg}/>
      </div>

      <ILabel>Active Courses</ILabel>
      <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
        {courses.map(([cid,ci])=>{
          const durationH=ci.totalSlots/SPG;
          const spans=ci.spanGroups.size;
          const isLong=spans>1;
          const startsHere=ci.spanGroups.has(cell.group)&&Math.min(...[...ci.spanGroups])===cell.group;
          return(
            <div key={cid} style={{borderRadius:10,overflow:"hidden",border:`1.5px solid ${isLong?`${DS.i400}55`:"rgba(200,200,210,0.45)"}`,background:"rgba(255,255,255,0.65)"}}>
              {/* Course name */}
              <div style={{padding:"8px 10px 6px",background:isLong?"rgba(99,102,241,0.08)":"rgba(248,248,252,0.8)"}}>
                {/* Full course name — scrollable horizontally if needed */}
                <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginBottom:5,paddingBottom:2}}>
                  <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:DS.z900,fontWeight:700,lineHeight:1.4,whiteSpace:"nowrap",display:"block"}}>{ci.label}</span>
                </div>
                {/* Pills row */}
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'Geist Mono',monospace",fontSize:9,padding:"2px 8px",borderRadius:6,background:DS.t50,border:`1px solid ${DS.t500}33`,color:DS.t700,fontWeight:700,whiteSpace:"nowrap"}}>
                    {durationH<1?`${Math.round(durationH*60)}min`:`${durationH}h`}
                  </span>
                  {isLong&&(
                    <span style={{fontFamily:"'Geist Mono',monospace",fontSize:9,padding:"2px 8px",borderRadius:6,background:DS.i50,border:`1px solid ${DS.i400}44`,color:DS.i700,fontWeight:700,whiteSpace:"nowrap"}}>
                      ↕ {spans} blocks
                    </span>
                  )}
                  {!startsHere&&(
                    <span style={{fontFamily:"'Geist Mono',monospace",fontSize:9,padding:"2px 8px",borderRadius:6,background:DS.amberBg,border:`1px solid ${DS.amber}44`,color:"#92400E",fontWeight:700,whiteSpace:"nowrap"}}>
                      cont'd
                    </span>
                  )}
                </div>
              </div>
              <div style={{padding:"5px 10px 7px",background:"rgba(245,245,250,0.6)",borderTop:"1px solid rgba(200,200,215,0.3)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z600,fontWeight:500}}>{ci.empCount} trainee{ci.empCount!==1?"s":""}</span>
                <span style={{fontFamily:"'Geist Mono',monospace",fontSize:7,color:DS.z400}}>{cid}</span>
              </div>
            </div>
          );
        })}
      </div>

      <ILabel>Trainees</ILabel>
      <div style={{maxHeight:160,overflowY:"auto",display:"flex",flexDirection:"column",gap:3}}>
        {data.employeeIds.slice(0,18).map(eid=>{
          const ci=courseInfo.get(data.empCourse[eid]);
          const dH=ci?ci.totalSlots/SPG:0;
          const isLong=ci?ci.spanGroups.size>1:false;
          return(
            <div key={eid} style={{padding:"5px 10px",background:"rgba(255,253,249,0.50)",border:`1px solid rgba(255,255,255,0.50)`,borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:DS.z800,fontWeight:600,marginBottom:1}}>{nodeMap[eid]?.label??eid}</div>
                <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.t600,overflowX:"auto",whiteSpace:"nowrap",WebkitOverflowScrolling:"touch",paddingBottom:1}}>{ci?.label}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.t700,fontWeight:700}}>
                  {dH<1?`${dH*60|0}min`:`${dH}h`}
                </span>
                {isLong&&<span style={{fontFamily:"'Geist Mono',monospace",fontSize:7,color:DS.i500,fontWeight:600}}>↕multi</span>}
              </div>
            </div>
          );
        })}
        {data.employeeIds.length>18&&<div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z500}}>+{data.employeeIds.length-18} more</div>}
      </div>
    </ICard>
  );
}

// ─── Overflow Bucket ─────────────────────────────────────────────────────────
function OverflowBucket({count,proj,snap}:{count:number;proj:Projection;snap:Snapshot}){
  const [open,setOpen]=useState(false);
  const [hovEmp,setHovEmp]=useState<string|null>(null);
  const [clickEmp,setClickEmp]=useState<string|null>(null);
  const tm=snap.time_model;
  // Collect all overflowed placements grouped by employee
  const overflowByEmp=new Map<string,{label:string;courses:{label:string;hours:number}[]}>();
  for(const p of snap.placements){
    if(!p.overflow) continue;
    const empLabel=proj.nodeMap[p.employee_id]?.label??p.employee_id;
    const courseLabel=proj.nodeMap[p.course_id]?.label??p.course_id;
    if(!overflowByEmp.has(p.employee_id)) overflowByEmp.set(p.employee_id,{label:empLabel,courses:[]});
    overflowByEmp.get(p.employee_id)!.courses.push({label:courseLabel,hours:p.duration_slots/4});
  }
  // Sort alphabetically by employee name
  const empEntries=[...overflowByEmp.entries()].sort((a,b)=>a[1].label.localeCompare(b[1].label));

  return(
    <div style={{borderRadius:12,overflow:"hidden",border:`1.5px solid ${DS.red}33`,background:"rgba(255,241,242,0.72)",animation:"wrs-fadein 0.3s ease"}}>
      {/* Header — always visible, click to expand */}
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:"100%",padding:"10px 12px",background:"transparent",border:"none",cursor:"pointer",
        display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:DS.red,boxShadow:`0 0 8px ${DS.red}66`,flexShrink:0}}/>
          <div style={{textAlign:"left"}}>
            <div style={{fontFamily:"'Geist Mono',monospace",fontSize:9,fontWeight:700,color:DS.red,letterSpacing:"0.10em",textTransform:"uppercase"}}>Overflow Bucket</div>
            <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:"#9F1239",marginTop:1}}>
              <strong>{count}</strong> placements couldn't fit in the window
            </div>
          </div>
        </div>
        <span style={{fontFamily:"'Geist Mono',monospace",fontSize:11,color:DS.red,fontWeight:700}}>{open?"▲":"▼"}</span>
      </button>

      {/* Explanation */}
      {open&&(
        <div style={{padding:"0 12px 10px"}}>
          <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:9,color:"#7F1D1D",lineHeight:1.65,marginBottom:10,padding:"8px 10px",background:"rgba(255,220,220,0.45)",borderRadius:8,border:`1px solid ${DS.red}22`}}>
            These employees have training that couldn't be placed within the {tm.training_window_days}-day window.
            This typically happens when the solver packs placements greedily and runs out of available slots.
            Expanding the window, enabling weekends, or switching to the CP-SAT solver (which spreads load more evenly) will reduce overflow.
          </div>
          <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.red,fontWeight:600,letterSpacing:"0.08em",marginBottom:8}}>
            AFFECTED EMPLOYEES — {empEntries.length} (alphabetical)
          </div>
          {/* Alphabetical list with hover tooltip showing unscheduled courses */}
          <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:320,overflowY:"auto"}}>
            {empEntries.map(([eid,{label,courses}])=>(
              <div key={eid} style={{position:"relative"}}
                onMouseEnter={()=>setHovEmp(eid)}
                onMouseLeave={()=>setHovEmp(null)}
                onClick={()=>setClickEmp(p=>p===eid?null:eid)}>
                <div style={{
                  padding:"7px 10px",
                  background:clickEmp===eid?"rgba(255,200,200,0.85)":hovEmp===eid?"rgba(255,220,220,0.7)":"rgba(255,255,255,0.55)",
                  border:`1px solid ${clickEmp===eid||hovEmp===eid?DS.red+"55":DS.red+"22"}`,
                  borderRadius:8,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"space-between",
                  transition:"background 0.12s,border 0.12s",
                }}>
                  <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:DS.z800,fontWeight:600}}>{label}</span>
                  <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.red,fontWeight:700,flexShrink:0,marginLeft:6}}>
                    {courses.length} course{courses.length!==1?"s":""} · {courses.reduce((s,c)=>s+c.hours,0).toFixed(1)}h
                  </span>
                </div>
                {/* Click popup — full course details */}
                {clickEmp===eid&&(
                  <div style={{
                    marginTop:4,padding:"10px 12px",
                    background:"rgba(255,255,255,0.92)",
                    border:`1.5px solid ${DS.red}44`,borderRadius:10,
                    boxShadow:"0 4px 18px rgba(239,68,68,0.12)",
                    animation:"wrs-fadein 0.12s ease",
                  }}>
                    <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.red,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7}}>
                      {label} — unscheduled courses
                    </div>
                    {courses.map((c,i)=>(
                      <div key={i} style={{padding:"5px 0",borderBottom:i<courses.length-1?`1px solid ${DS.red}18`:"none",display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
                        <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:DS.z800,lineHeight:1.4,flex:1}}>{c.label}</span>
                        <span style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:DS.red,fontWeight:700,flexShrink:0}}>{c.hours}h</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Hover hint when not clicked */}
                {hovEmp===eid&&clickEmp!==eid&&(
                  <div style={{
                    position:"absolute",right:4,bottom:-18,zIndex:600,
                    fontFamily:"'Geist Mono',monospace",fontSize:7,color:DS.red,
                    opacity:0.6,pointerEvents:"none",
                  }}>click to expand</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Employee Inspector ───────────────────────────────────────────────────────
function EmployeeInspector({empId,proj,snap,onClose}:{empId:string;proj:Projection;snap:Snapshot;onClose:()=>void}){
  const {nodeMap,empPlacements}=proj, tm=snap.time_model, node=nodeMap[empId];
  const allP=(empPlacements[empId]??[]).filter(p=>!p.overflow);
  const byDay:Record<number,Placement[]>={};
  for(const p of allP){if(!byDay[p.day_index]) byDay[p.day_index]=[]; byDay[p.day_index].push(p);}
  const sortedDays=Object.keys(byDay).map(Number).sort((a,b)=>a-b);
  const courseMap=new Map<string,{label:string;hours:number}>();
  for(const p of allP) if(!courseMap.has(p.course_id)) courseMap.set(p.course_id,{label:nodeMap[p.course_id]?.label??p.course_id,hours:p.duration_slots/4});
  const totalH=allP.reduce((s,p)=>s+p.duration_slots,0)/4;
  return(
    <ICard accent={DS.amber}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <ILabel color={DS.amber}>Employee Focus</ILabel>
          <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:14,color:DS.z900,fontWeight:700,lineHeight:1.3}}>{node?.label??empId}</div>
        </div>
        <button onClick={onClose} style={{width:26,height:26,borderRadius:8,background:DS.z100,border:`1px solid ${DS.z200}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:DS.z500,fontSize:15,fontWeight:700,flexShrink:0}}>×</button>
      </div>

      {/* Shift Pattern section — shown when node has shift info OR always with fallback */}
      {(()=>{
        const def=node?.shift_name
          ? SHIFT_DEFS.find(d=>d.name===node.shift_name||d.shortName===node.shift_name||d.id===node.shift_name)
          : null;
        // If no shift data from backend, show a placeholder
        if(!def&&!node?.shift_name) return(
          <div style={{marginBottom:12,padding:"9px 11px",background:"rgba(244,244,245,0.7)",border:`1px solid rgba(220,220,228,0.5)`,borderRadius:10}}>
            <ILabel>Shift Pattern</ILabel>
            <div style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:DS.z500}}>Not assigned — regenerate with shift patterns enabled</div>
          </div>
        );
        const shiftColor = def?.id==="core4on4off"?DS.violet:def?.id==="panama223"?DS.t600:DS.amber;
        const shiftBg    = def?.id==="core4on4off"?DS.violetBg:def?.id==="panama223"?DS.t50:DS.amberBg;
        return(
          <div style={{marginBottom:12,padding:"10px 12px",background:shiftBg,border:`1px solid ${shiftColor}28`,borderRadius:11}}>
            <ILabel color={shiftColor}>Shift Pattern</ILabel>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div>
                <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:12,color:DS.z900,fontWeight:700,lineHeight:1.2}}>{def?.name??node?.shift_name}</div>
                <div style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:shiftColor,marginTop:2}}>
                  {def?.shortName??""} · {def?.hoursPerShift??8}h/shift · {def?.cycleLength??7}d cycle
                </div>
              </div>
              <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:shiftColor,background:`${shiftColor}18`,border:`1px solid ${shiftColor}30`,borderRadius:6,padding:"2px 7px",flexShrink:0}}>
                {def?.teams??"—"}
              </div>
            </div>

            {/* Hours bar */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {[
                ["Shift length", `${def?.hoursPerShift??8}h`],
                ["Cycle", `${def?.cycleLength??7} days`],
                ["Hours/week", def?.id==="standard52"?"42.5h":def?.id==="panama223"?"42h":"42h avg"],
              ].map(([k,v])=>(
                <div key={k}>
                  <div style={{fontFamily:"'Geist Mono',monospace",fontSize:7,color:shiftColor,opacity:0.7,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:1}}>{k}</div>
                  <div style={{fontFamily:"'Geist Mono',monospace",fontSize:10,color:DS.z900,fontWeight:700}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Category tag */}
            <div style={{marginTop:8,fontFamily:"'Geist',system-ui,sans-serif",fontSize:9,color:shiftColor,opacity:0.85,lineHeight:1.5}}>
              {def?.category}
            </div>
          </div>
        );
      })()}

      <div style={{display:"flex",gap:6,marginBottom:12}}>
        <IBadge v={sortedDays.length} l="days" color={DS.i600} bg={DS.i50}/>
        <IBadge v={`${totalH.toFixed(1)}h`} l="total" color={DS.t600} bg={DS.t50}/>
        <IBadge v={courseMap.size} l="courses" color={DS.violet} bg={DS.violetBg}/>
      </div>

      <ILabel>Courses</ILabel>
      <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:12}}>
        {[...courseMap.entries()].map(([cid,{label,hours}])=>(
          <div key={cid} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 10px",background:"rgba(255,253,249,0.55)",border:`1px solid rgba(255,255,255,0.55)`,borderRadius:8}}>
            <div style={{overflowX:"auto",flex:1,WebkitOverflowScrolling:"touch",marginRight:6}}>
              <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:DS.z700,whiteSpace:"nowrap",fontWeight:500,display:"block"}}>{label}</span>
            </div>
            <span style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:DS.t600,fontWeight:600,flexShrink:0}}>{hours.toFixed(1)}h</span>
          </div>
        ))}
      </div>

      <ILabel>Schedule</ILabel>
      <div style={{maxHeight:185,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
        {sortedDays.map(d=>{
          const iso=tm.start_date?addDays(tm.start_date,d):"";
          const dayP=byDay[d], dayH=dayP.reduce((s,p)=>s+p.duration_slots,0)/4;
          return(
            <div key={d} style={{padding:"7px 10px",background:"rgba(255,253,249,0.55)",border:`1px solid rgba(255,255,255,0.55)`,borderRadius:9}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:DS.i600,fontWeight:700}}>{iso?fmtShort(iso):`Day ${d+1}`}</span>
                <span style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:DS.z400}}>{dayH.toFixed(1)}h</span>
              </div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {dayP.map(p=>{
                  const sH=tm.day_start_hour+p.start_slot/4, eH=sH+p.duration_slots/4;
                  const f=(n:number)=>`${String(Math.floor(n)).padStart(2,"0")}:${n%1>=0.5?"30":"00"}`;
                  return(
                    <span key={p.id} style={{fontFamily:"'Geist Mono',monospace",fontSize:8,background:`${DS.t500}12`,color:DS.t700,padding:"2px 7px",borderRadius:6,border:`1px solid ${DS.t500}1A`,whiteSpace:"nowrap"}}>{f(sH)}–{f(eH)}</span>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!sortedDays.length&&<div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,color:DS.z400,textAlign:"center",padding:16}}>No placements scheduled.</div>}
      </div>
    </ICard>
  );
}

// ─── Dock Button ──────────────────────────────────────────────────────────────
function DockBtn({label,onClick,disabled,ghost,wide}:{label:React.ReactNode;onClick:()=>void;disabled?:boolean;ghost?:boolean;wide?:boolean}){
  const [hov,setHov]=useState(false);
  return(
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        padding:`9px ${wide?"26px":"20px"}`,
        background: ghost
          ? (hov?DS.i50:"transparent")
          : (disabled?"rgba(99,102,241,0.20)":`linear-gradient(135deg,${DS.i500} 0%,${DS.t500} 100%)`),
        border: ghost?`1.5px solid ${hov?DS.i400:DS.i200}`:"none",
        borderRadius:14,
        cursor:disabled?"not-allowed":"pointer",
        fontFamily:"'Geist',system-ui,sans-serif",
        fontSize:13, fontWeight:700, letterSpacing:"-0.01em",
        color: ghost?DS.i600:"white",
        transition:"all 0.18s ease",
        opacity:disabled?0.45:1,
        boxShadow: ghost
          ? (hov?`0 4px 12px ${DS.i500}18`:"none")
          : (disabled?"none":`0 4px 20px ${DS.i500}40, 0 1px 0 rgba(255,255,255,0.18) inset`),
        whiteSpace:"nowrap",
      }}
    >{label}</button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function WorkforceSim(){
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const xAxisRef     = useRef<HTMLDivElement>(null);
  const hovEmpRef    = useRef<string|null>(null);
  const chRef        = useRef<number>(28);
  const rafRef       = useRef<number>(0);
  const animRef      = useRef<number>(0);
  const animVal      = useRef<number>(1);

  const [sim,      setSim]      = useState<Simulation|null>(null);
  const [status,   setStatus]   = useState<Status>("idle");
  const [selCell,  setSelCell]  = useState<{day:number;group:number;room:number}|null>(null);
  const [selEmp,   setSelEmp]   = useState<string|null>(null);
  const [sidecar,  setSidecar]  = useState(true);
  const [ch,       setCH]       = useState(500);
  const [tip,      setTip]      = useState<Tooltip|null>(null);
  const [t0,       setT0]       = useState<number|null>(null);
  const [t1,       setT1]       = useState<number|null>(null);
  const [live,     setLive]     = useState(0);
  const [scoreH,   setScoreH]   = useState<number[]>([0]);
  const [compH,    setCompH]    = useState<number[]>([0]);
  const [scoreFlash,   setScoreFlash]   = useState(false); // post-solve attention pulse
  const [showOverflowPanel, setShowOverflowPanel] = useState(false);
  const [complexity,   setComplexity]   = useState<Complexity|null>(null);
  const [solveMetadata, setSolveMetadata] = useState<SolveMetadata|null>(null);
  const [deepSolving,  setDeepSolving]  = useState(false);  // true while SSE deep-solve is running
  const [deepSolveStopped, setDeepSolveStopped] = useState(false); // true after user clicks "Good enough"
  const currentTimeLimitRef = useRef<number>(SOLVE_LIMIT_S); // tracks actual time limit for countdown
  const lastStreamedSnapRef = useRef<Snapshot|null>(null);   // last snapshot received from SSE stream
  const [zoom,     setZoom]     = useState(1);   // 0.5 | 1 | 1.5 | 2 | 3
  const [numTrainers, setNumTrainers] = useState<1|2>(1); // 1 or 2 rooms/trainers
  const [simNumTrainers, setSimNumTrainers] = useState<1|2>(1); // what was used when simulated
  const cwZ = Math.round(CW * zoom);             // zoomed cell width

  useEffect(()=>{
    if(!t0||t1) return;
    // Countdown: update every 100ms so display is smooth
    const id=setInterval(()=>setLive(Date.now()-t0),100);
    return()=>clearInterval(id);
  },[t0,t1]);

  // solveDisplay returns a bare number string; the tile renders the unit separately
  const solveProgress = t0&&!t1 ? (deepSolving ? Math.min(1, live/(currentTimeLimitRef.current*1000)) : Math.min(1, live/(SOLVE_LIMIT_S*1000))) : undefined;
  const solverMsgIdx  = t0&&!t1 ? Math.min(SOLVER_MESSAGES.length-1, Math.floor((live/1000)/2.2)) : -1;
  const solverMsg     = solverMsgIdx>=0 ? SOLVER_MESSAGES[solverMsgIdx] : null;
  const solveDisplay=useMemo(()=>{
    if(t1&&t0){
      const s=(t1-t0)/1000;
      return s<60?`${s.toFixed(1)}`:`${Math.floor(s/60)}m${Math.round(s%60)}`;
    }
    if(t0&&!t1){
      if(deepSolving){
        // Deep solve: count UP (elapsed)
        const elapsed=live/1000;
        return elapsed<60?`${elapsed.toFixed(1)}`:`${Math.floor(elapsed/60)}m${Math.round(elapsed%60)}`;
      }
      // Fast solve: count DOWN (remaining)
      const remaining=Math.max(0, SOLVE_LIMIT_S*1000-live)/1000;
      return `${remaining.toFixed(1)}`;
    }
    return "—";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[t0,t1,live,deepSolving]);

  const today    = useMemo(()=>toIso(new Date()),[]);
  const maxStart = useMemo(()=>addMonths(today,6),[today]);

  const [prof,setProf]=useState({
    employees:50, roles:10, courses:20, relationship_density:0.5,
    day_start_hour:7, day_end_hour:19,
    start_date:today, end_date:addMonths(today,1),
    allow_saturday:false, allow_sunday:false,
    max_classroom:20,
  });
  // Which optional shift patterns are enabled + approx % of employees on each
  const [shiftEnabled,setShiftEnabled]=useState<Record<ShiftId,boolean>>({
    core4on4off:true, panama223:false, standard52:false,
  });
  const [shiftSplit,setShiftSplit]=useState<Record<ShiftId,number>>({
    core4on4off:70, panama223:20, standard52:10,
  });
  const minEnd=addDays(prof.start_date,14), maxEnd=addDays(prof.start_date,90);
  const windowDays=daysBetween(prof.start_date,prof.end_date);

  // Fonts + global CSS
  useEffect(()=>{
    const fonts=document.createElement("link"); fonts.rel="stylesheet";
    fonts.href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap";
    document.head.appendChild(fonts);
    const style=document.createElement("style");
    style.textContent=`
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      html,body{height:100%;overflow:hidden}
      body{
        font-family:'Geist',system-ui,sans-serif;
        background-color:#E8DDD0;
        background-image:
          linear-gradient(to bottom,rgba(255,255,255,0.48) 0%,rgba(240,245,255,0.40) 50%,rgba(235,250,245,0.42) 100%),
          url('/sun.jpg');
        background-size:cover;
        background-position:center 40%;
        background-attachment:fixed;
      }
      @keyframes wrs-spring{
        0%{opacity:0;transform:scale(0.94) translateY(8px)}
        60%{opacity:1;transform:scale(1.01) translateY(-1px)}
        100%{opacity:1;transform:scale(1) translateY(0)}
      }
      @keyframes wrs-pulse{0%,100%{opacity:1}50%{opacity:0.25}}
      @keyframes wrs-fadein{from{opacity:0}to{opacity:1}}
      @keyframes wrs-aurora{
        0%,100%{transform:translate(0,0) scale(1)}
        33%{transform:translate(2%,1%) scale(1.03)}
        66%{transform:translate(-1%,2%) scale(0.97)}
      }
      @keyframes score-flash{
        0%{background:rgba(99,102,241,0.08);box-shadow:none}
        15%{background:#6366F1;box-shadow:0 0 0 3px #6366F155,0 0 24px #6366F188}
        40%{background:#6366F1;box-shadow:0 0 0 3px #6366F155,0 0 24px #6366F188}
        70%{background:rgba(99,102,241,0.12);box-shadow:0 0 0 2px #6366F133}
        100%{background:rgba(255,255,255,0.55);box-shadow:none}
      }
      @keyframes score-flash-text{
        0%,100%{color:#09090B}
        15%,40%{color:white}
      }
      @keyframes blob-morph{
        0%,100%{border-radius:60% 40% 30% 70% / 60% 30% 70% 40%}
        25%{border-radius:30% 60% 70% 40% / 50% 60% 30% 60%}
        50%{border-radius:50% 50% 20% 80% / 25% 80% 20% 75%}
        75%{border-radius:67% 33% 47% 53% / 37% 20% 80% 63%}
      }
      @keyframes blob-spin{
        from{transform:rotate(0deg)}
        to{transform:rotate(360deg)}
      }
      @keyframes blob-in{
        from{opacity:0;transform:scale(0.75)}
        to{opacity:1;transform:scale(1)}
      }

      input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer;height:20px}
      input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:${DS.i500};border:2px solid white;box-shadow:0 1px 6px ${DS.i500}55,0 0 0 3px ${DS.i100};margin-top:-6.5px;cursor:pointer}
      input[type=range]::-webkit-slider-runnable-track{height:3px;background:${DS.z200};border-radius:2px}
      ::-webkit-scrollbar{width:4px;height:4px}
      ::-webkit-scrollbar-thumb{background:${DS.z200};border-radius:3px}
      ::-webkit-scrollbar-track{background:transparent}
    `;
    // Replace 'Geist' references to 'Geist' since we load DM Sans
    document.head.appendChild(style);
    return()=>{document.head.removeChild(fonts);document.head.removeChild(style);};
  },[]);

  useEffect(()=>{
    const el=containerRef.current; if(!el) return;
    const ro=new ResizeObserver(e=>{ for(const en of e) setCH(en.contentRect.height); });
    ro.observe(el); setCH(el.clientHeight); return()=>ro.disconnect();
  },[]);

  const proj=useMemo(()=>sim?.snapshot?buildProjection(sim.snapshot):null,[sim]);

  const startAnim=useCallback(()=>{
    animVal.current=0;
    const t0=performance.now();
    const dur=500;
    const tick=(now:number)=>{
      const t=Math.min((now-t0)/dur,1);
      animVal.current=t<0.5?4*t*t*t:1-(-2*t+2)**3/2;
      if(t<1) animRef.current=requestAnimationFrame(tick);
      else animVal.current=1;
    };
    animRef.current=requestAnimationFrame(tick);
  },[]);

  const redraw=useCallback((hEmp:string|null)=>{
    if(!canvasRef.current||!proj||!sim?.snapshot||ch<10) return;
    const r=drawCanvas(canvasRef.current,proj,sim.snapshot,ch,hEmp,selCell,selEmp,animVal.current,prof.allow_saturday,prof.allow_sunday,cwZ,numTrainers);
    if(r) chRef.current=r;
  },[proj,sim,ch,selCell,selEmp,prof.allow_saturday,prof.allow_sunday,cwZ,numTrainers]);

  // Continuous animation loop for entrance
  useEffect(()=>{
    let running=true;
    const loop=()=>{ if(!running) return; redraw(hovEmpRef.current); if(animVal.current<1) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    return()=>{running=false;};
  },[redraw]);

  function getEmpAt(e:React.MouseEvent<HTMLCanvasElement>):string|null{
    if(!proj||!canvasRef.current) return null;
    const cv=canvasRef.current, r=cv.getBoundingClientRect(), CH=chRef.current;
    const logX=(e.clientX-r.left)-YM, logY=(e.clientY-r.top);
    if(logX<0) return null;
    const day=Math.floor(logX/cwZ), grp=Math.floor(logY/CH);
    if(day<0||day>=proj.days||grp<0||grp>=proj.groups) return null;
    const useTwoLanes=isOpt&&numTrainers===2;
    const laneW=useTwoLanes?Math.max(11,Math.floor(cwZ/2)):cwZ;
    const xInDay=logX-day*cwZ;
    const room=useTwoLanes?(xInDay>=laneW?1:0):0;
    const xInLane=xInDay-(useTwoLanes?room*laneW:0);
    const cell=useTwoLanes?proj.roomGrids[room][day][grp]:proj.grid[day][grp];
    if(!cell.employeeIds.length) return null;
    const P=2;
    const micro=Math.max(3,Math.min(11,Math.floor(Math.sqrt((laneW-P*2-4)*(CH-P*2-4)/Math.max(proj.maxEmpPerLane,1)))));
    const stride=micro+1, cols=Math.max(1,Math.floor((laneW-P*2-4)/stride));
    const lx=xInLane-P-2, ly=logY-grp*CH-P-2;
    if(lx<0||ly<0) return null;
    return cell.employeeIds[Math.floor(ly/stride)*cols+Math.floor(lx/stride)]??null;
  }

  function getCellAt(e:React.MouseEvent<HTMLCanvasElement>):{day:number;group:number;room:number}|null{
    if(!proj||!canvasRef.current) return null;
    const r=canvasRef.current.getBoundingClientRect(), CH=chRef.current;
    const logX=(e.clientX-r.left)-YM, logY=(e.clientY-r.top);
    if(logX<0) return null;
    const day=Math.floor(logX/cwZ), grp=Math.floor(logY/CH);
    if(day<0||day>=proj.days||grp<0||grp>=proj.groups) return null;
    const useTwoLanes=isOpt&&numTrainers===2;
    const laneW=useTwoLanes?Math.max(11,Math.floor(cwZ/2)):cwZ;
    const xInDay=logX-day*cwZ;
    const room=useTwoLanes?(xInDay>=laneW?1:0):0;
    return {day,group:grp,room};
  }

  const handleMove=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{
    if(!proj||!sim?.snapshot) return;
    const empId=getEmpAt(e);
    if(empId!==hovEmpRef.current){
      hovEmpRef.current=empId;
      if(empId){
        const r=canvasRef.current!.getBoundingClientRect(), CH=chRef.current;
        const day=Math.floor(((e.clientX-r.left)-YM)/cwZ), grp=Math.floor((e.clientY-r.top)/CH);
        const cell=proj.grid[day]?.[grp];
        const cid=cell?.empCourse[empId]??"";
        const pl=cell?.items.find(p=>p.employee_id===empId);
        setTip({empId,name:proj.nodeMap[empId]?.label??empId,courseName:proj.nodeMap[cid]?.label??cid,durationH:(pl?.duration_slots??0)/4,x:e.clientX,y:e.clientY});
      } else setTip(null);
      if(rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current=requestAnimationFrame(()=>redraw(empId));
    } else if(empId&&tip) setTip(t=>t?{...t,x:e.clientX,y:e.clientY}:null);
  },[proj,sim,redraw,tip]);

  function clearHov(){
    if(hovEmpRef.current!==null){
      hovEmpRef.current=null; setTip(null);
      if(rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current=requestAnimationFrame(()=>redraw(null));
    }
  }

  const handleClick=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{
    if(!proj||!canvasRef.current) return;
    const cell=getCellAt(e);
    if(!cell) return;
    const {day,group,room}=cell;
    const thisCellAlreadySelected=selCell?.day===day&&selCell?.group===group&&selCell?.room===room;
    if(thisCellAlreadySelected){
      const empId=getEmpAt(e);
      if(empId){ setSelEmp(p=>p===empId?null:empId); }
      else { setSelCell(null); setSelEmp(null); }
    } else {
      setSelCell({day,group,room});
      setSelEmp(null);
    }
  },[proj,selCell,sim]);

  const generate=async()=>{
    setStatus("generating"); setSelCell(null); setSelEmp(null); setT0(null); setT1(null); setTip(null); setComplexity(null); setSolveMetadata(null); setDeepSolveStopped(false);
    try{
      const enabledPatterns=SHIFT_DEFS.filter(d=>shiftEnabled[d.id as ShiftId]);
      const payload={
        ...prof,
        num_rooms: numTrainers,
        shift_patterns: enabledPatterns.length,
        shift_pattern_ids: enabledPatterns.map(d=>d.id),
        shift_split: Object.fromEntries(enabledPatterns.map(d=>[d.id, shiftSplit[d.id as ShiftId]])),
      };
      const res=await fetch(`${API}/simulate/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if(!res.ok) throw new Error();
      const data:Simulation=await res.json();
      // Enforce weekend restrictions client-side (backend doesn't yet model this)
      data.snapshot=filterWeekendPlacements(data.snapshot,prof.allow_saturday,prof.allow_sunday);
      setSim(data);
      setSimNumTrainers(numTrainers);
      // Fetch complexity estimate for this simulation
      try {
        const cxRes = await fetch(`${API}/simulate/complexity/${data.simulation_id}`);
        if (cxRes.ok) setComplexity(await cxRes.json());
      } catch { /* non-fatal */ }
      const sc=data.snapshot?.metrics?.score??0;
      setScoreH(h=>[...h.slice(-9),sc]);
      setStatus("generated");
      startAnim();
    }catch{setStatus("error");}
  };

  const solve=async()=>{
    if(!sim) return;
    currentTimeLimitRef.current = SOLVE_LIMIT_S;
    lastStreamedSnapRef.current = null;
    setT0(Date.now()); setT1(null); setLive(0); setStatus("solving"); setSolveMetadata(null); setDeepSolving(false); setDeepSolveStopped(false);
    try{
      const res=await fetch(`${API}/simulate/solve/${sim.simulation_id}?num_rooms=${numTrainers}&time_limit_seconds=${SOLVE_LIMIT_S}`,{method:"POST"});
      if(!res.ok) throw new Error();
      setT1(Date.now());
      const data:Simulation=await res.json();
      data.snapshot=filterWeekendPlacements(data.snapshot,prof.allow_saturday,prof.allow_sunday);
      setSim(data);
      setSolveMetadata(data.snapshot.solve_metadata??null);
      const sc=data.snapshot?.metrics?.score??0;
      const co=data.snapshot?.metrics?.compression_percent??0;
      setScoreH(h=>[...h.slice(-9),sc]);
      setCompH(h=>[...h.slice(-9),co]);
      setStatus("solved");
      startAnim();
      setScoreFlash(true);
      setSidecar(false);
      setZoom(2);
      setTimeout(()=>setScoreFlash(false), 2800);
    }catch{setT1(Date.now());setStatus("error");}
  };

  // Deep solve — user opts in after fast feasible result. Streams improving solutions via SSE.
  const deepSolveEsRef = useRef<EventSource|null>(null);

  const stopDeepSolve = () => {
    if(deepSolveEsRef.current){ deepSolveEsRef.current.close(); deepSolveEsRef.current=null; }
    // Commit the last best snapshot received from the stream
    if(lastStreamedSnapRef.current){
      const snap=lastStreamedSnapRef.current;
      setSim(s=>s?{...s,snapshot:snap}:s);
      setSolveMetadata(snap.solve_metadata??null);
      setScoreH(h=>[...h.slice(-9),snap.metrics?.score??0]);
      setCompH(h=>[...h.slice(-9),snap.metrics?.compression_percent??0]);
      startAnim();
    }
    setT1(Date.now()); setStatus("solved"); setDeepSolving(false); setDeepSolveStopped(true);
  };

  const deepSolve=async()=>{
    if(!sim||deepSolving) return;
    setDeepSolving(true); setDeepSolveStopped(false);
    lastStreamedSnapRef.current = null;
    const timeLimit=Math.max(DEEP_SOLVE_LIMIT_S, Math.ceil(complexity?.estimated_seconds??DEEP_SOLVE_LIMIT_S));
    currentTimeLimitRef.current = timeLimit;
    setT0(Date.now()); setT1(null); setLive(0); setStatus("solving");
    try{
      const es=new EventSource(`${API}/simulate/solve-stream/${sim.simulation_id}?time_limit_seconds=${timeLimit}&num_rooms=${numTrainers}`);
      deepSolveEsRef.current = es;
      es.onmessage=(ev)=>{
        try{
          const item=JSON.parse(ev.data);
          if(item.type==="progress"&&item.snapshot){
            const snap=filterWeekendPlacements(item.snapshot,prof.allow_saturday,prof.allow_sunday);
            lastStreamedSnapRef.current = snap;
            setSim(s=>s?{...s,snapshot:snap}:s);
            setSolveMetadata(snap.solve_metadata??null);
            startAnim();
          }
          if(item.type==="done"){
            es.close(); setT1(Date.now());
            if(item.snapshot){
              const snap=filterWeekendPlacements(item.snapshot,prof.allow_saturday,prof.allow_sunday);
              lastStreamedSnapRef.current = snap;
              setSim(s=>s?{...s,snapshot:snap}:s);
              setSolveMetadata(snap.solve_metadata??null);
              setScoreH(h=>[...h.slice(-9),snap.metrics?.score??0]);
              setCompH(h=>[...h.slice(-9),snap.metrics?.compression_percent??0]);
            }
            setStatus("solved"); setDeepSolving(false); startAnim();
            setScoreFlash(true); setTimeout(()=>setScoreFlash(false),2800);
          }
          if(item.type==="timeout"||item.type==="error"){
            es.close(); setT1(Date.now()); setStatus("solved"); setDeepSolving(false);
          }
        }catch{/*ignore*/}
      };
      es.onerror=()=>{ es.close(); setT1(Date.now()); setStatus("solved"); setDeepSolving(false); };
    }catch{ setT1(Date.now()); setStatus("error"); setDeepSolving(false); }
  };

  const snap=sim?.snapshot, m=snap?.metrics, tm=snap?.time_model;
  const isOpt=snap?.phase==="optimized";
  const useTwoLanesUI=isOpt&&numTrainers===2;
  const isActive=["generating","solving"].includes(status)||deepSolving;
  const selData=selCell&&proj?(useTwoLanesUI?proj.roomGrids[selCell.room??0][selCell.day]?.[selCell.group]:proj.grid[selCell.day]?.[selCell.group]):null;

  const dayInfos=useMemo(()=>{
    if(!tm) return [];
    const base=tm.start_date??today;
    return Array.from({length:tm.training_window_days},(_,d)=>{
      const iso=addDays(base,d), dt=new Date(iso), dow=dowOf(iso);
      return{d,letter:DOW[dow],dayNum:dt.getDate(),month:dt.toLocaleDateString("en-NZ",{month:"short"}),isWeekend:dow===0||dow===6,isMon:dow===1,dow};
    });
  },[tm,today]);

  const startHrs=Array.from({length:23},(_,i)=>i);
  const endHrs=Array.from({length:24},(_,i)=>i+1).filter(h=>h>prof.day_start_hour);

  const statusLabels:Record<Status,string>={idle:"Ready",generating:"Generating…",generated:"Planned",solving:"Optimizing…",solved:"Optimized",error:"Error"};
  const statusColors:Record<Status,string>={idle:DS.z300,generating:DS.amber,generated:DS.i500,solving:DS.t500,solved:DS.emerald,error:DS.red};

  return(
    <div style={{width:"100vw",height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>

      {/* Aurora orbs — fixed, breathing */}
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-25%",left:"-15%",width:"55vw",height:"55vh",background:`radial-gradient(ellipse,rgba(99,102,241,0.10) 0%,transparent 60%)`,animation:"wrs-aurora 12s ease-in-out infinite",borderRadius:"50%"}}/>
        <div style={{position:"absolute",bottom:"-20%",right:"-10%",width:"50vw",height:"50vh",background:`radial-gradient(ellipse,rgba(13,148,136,0.08) 0%,transparent 60%)`,animation:"wrs-aurora 16s ease-in-out infinite reverse",borderRadius:"50%"}}/>
        <div style={{position:"absolute",top:"35%",right:"25%",width:"30vw",height:"30vh",background:`radial-gradient(ellipse,rgba(139,92,246,0.06) 0%,transparent 60%)`,animation:"wrs-aurora 20s ease-in-out infinite",borderRadius:"50%"}}/>
      </div>

      {/* Tooltip */}
      {tip&&(
        <div style={{position:"fixed",left:tip.x+14,top:tip.y-10,zIndex:400,pointerEvents:"none",background:DS.z900,borderRadius:12,padding:"9px 13px",boxShadow:"0 8px 28px rgba(0,0,0,0.18)",animation:"wrs-spring 0.15s cubic-bezier(0.34,1.56,0.64,1)",minWidth:175}}>
          <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:12,color:"white",fontWeight:700,marginBottom:3,letterSpacing:"-0.01em"}}>{tip.name}</div>
          <div style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:DS.t400,marginBottom:2}}>{tip.courseName}</div>
          <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:"rgba(255,255,255,0.35)"}}>{tip.durationH.toFixed(2)}h — click to focus</div>
        </div>
      )}

      {/* ── INTELLIGENCE HEADER ── */}
      <header style={{
        flexShrink:0, position:"relative", zIndex:20,
        background:"rgba(255,255,255,0.62)",
        backdropFilter:"blur(32px)", WebkitBackdropFilter:"blur(32px)",
        borderBottom:`1px solid rgba(255,255,255,0.55)`,
        boxShadow:"0 1px 0 rgba(255,255,255,0.7), 0 2px 24px rgba(120,80,20,0.10)",
      }}>
        <div style={{display:"flex",alignItems:"stretch",gap:0,padding:"10px 20px 10px 20px",minHeight:72}}>

          {/* ── LEFT: Wordmark + description ── */}
          <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0,marginRight:24,paddingRight:24,borderRight:`1px solid rgba(255,255,255,0.15)`,cursor:"default",position:"relative"}}
            onMouseEnter={e=>{const t=document.getElementById("cpsat-tip"); if(t) t.style.opacity="1";}}
            onMouseLeave={e=>{const t=document.getElementById("cpsat-tip"); if(t) t.style.opacity="0";}}>
            {/* Animated amorphous AI blob — CSS-only Framer Motion equivalent */}
            <div style={{
              width:44,height:44,flexShrink:0,
              animation:"blob-in 0.8s cubic-bezier(0.34,1.56,0.64,1) both",
            }}>
              {/* Outer spin wrapper — 12s full rotation like Framer version */}
              <div style={{
                width:"100%",height:"100%",
                animation:"blob-spin 12s linear infinite",
              }}>
                {/* Morphing blob — 4s borderRadius cycle */}
                <div style={{
                  width:"100%",height:"100%",
                  background:`linear-gradient(135deg, ${DS.i400} 0%, ${DS.i500} 40%, ${DS.t500} 100%)`,
                  boxShadow:`0 6px 28px ${DS.i500}55, 0 2px 8px ${DS.t500}33`,
                  animation:"blob-morph 4s ease-in-out infinite",
                }}/>
              </div>
            </div>
            <div style={{maxWidth:290}}>
              <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:15,fontWeight:800,color:DS.z900,letterSpacing:"-0.03em",lineHeight:1,marginBottom:3}}>
                Enterprise <span style={{color:DS.i500}}>Training</span> <span style={{color:DS.t600}}>Scheduler</span>
              </div>
<div style={{fontFamily:"'Geist Mono',monospace",fontSize:7.5,color:DS.z500,letterSpacing:"0.05em",fontWeight:500,marginBottom:5,textTransform:"uppercase"}}>Proof of Concept Simulator · CP-SAT Optimisation</div>
  <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:DS.z600,lineHeight:1.55,maxWidth:285}}>
  Experience how Google&apos;s CP-SAT solver transforms complex workforce scheduling — from weeks of manual planning to seconds of computation using synthetic data.{" "}
              </div>
            </div>
            {/* CP-SAT hover tooltip */}
            <div id="cpsat-tip" style={{
              position:"absolute",top:"calc(100% + 10px)",left:0,zIndex:500,
              width:320,padding:"14px 16px",
              background:"rgba(15,12,35,0.96)",
              border:`1px solid ${DS.i400}44`,
              borderRadius:14,
              boxShadow:"0 16px 48px rgba(0,0,0,0.35)",
              opacity:0,transition:"opacity 0.18s ease",
              pointerEvents:"none",
            }}>
              <div style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:"#A5B4FC",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>What is CP-SAT Optimisation?</div>
              <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,color:"rgba(255,255,255,0.82)",lineHeight:1.7,marginBottom:10}}>
                CP-SAT stands for <strong style={{color:"white"}}>Constraint Programming — Satisfiability</strong>. It is Google's industrial-grade mathematical solver, used by logistics companies, airlines and hospitals to solve scheduling problems that would take humans weeks to work through manually.
              </div>
              <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,color:"rgba(255,255,255,0.82)",lineHeight:1.7,marginBottom:10}}>
                Instead of trying every possible combination (which would take longer than the age of the universe for large workforces), CP-SAT intelligently prunes the solution space using constraints — things like <em>"no employee can attend two courses at once"</em> or <em>"max 20 people per classroom"</em> — and finds the best possible schedule in seconds.
              </div>
              <div style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:DS.t400,fontWeight:600}}>Result: what a team of planners would take weeks to do manually, solved optimally in under 30 seconds.</div>
            </div>
          </div>

          {/* ── RIGHT: Metric tiles ── */}
          <div style={{flex:1,display:"flex",gap:7,alignItems:"stretch",minWidth:0}}>
            <MetricTile label="Solve Time"
              display={solveDisplay}
              unit={solveDisplay==="—"?undefined:"s"}
              progress={solveProgress}
              color={DS.z500} accent={DS.z300}
              sub={
                deepSolving
                  ? `⟳ Deep solving… est. ~${Math.round(currentTimeLimitRef.current)}s total`
                  : m?.solver==="cpsat_optimal" ? "✓ Optimal"
                  : m?.solver==="cpsat_feasible" ? "~ Feasible — not yet proven optimal"
                  : undefined
              }
              tooltip="During the fast solve (30s), the timer counts DOWN showing time remaining. During deep solve, it counts UP showing elapsed time, with the estimated total shown below. '✓ Optimal' means the schedule is mathematically proven best. '~ Feasible' means a good solution was found but more time may improve it."/>
            <MetricTile label="Readiness Score"
              display={m?.score??0} unit="%" spark={scoreH} color={DS.i500} accent={DS.i400}
              flash={scoreFlash}
              onClick={isOpt&&proj&&proj.overflowCount>0?()=>setShowOverflowPanel(p=>!p):undefined}
              tooltip={(()=>{
                if(!isOpt) return "A 0–100 score: the percentage of training placements successfully scheduled. Run Optimise Schedule to calculate this.";
                if(m?.score===100) return "✓ 100% — All training placements were successfully scheduled within the window. Every employee has all required courses booked.";
                const overflow=m?.overflow_count??0;
                const total=(m as any)?.total_placements??0;
                const scheduled=(m as any)?.scheduled_placements??(total-overflow);
                const affectedEmps=snap?.placements?.filter(p=>p.overflow).map(p=>p.employee_id).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i).length??0;
                return `Your workforce is ${m?.score??0}% ready. ${scheduled} of ${total} training placements were scheduled successfully. ${overflow} placements (across ${affectedEmps} employees) could not fit within the ${tm?.training_window_days??0}-day window. To reach 100%: extend the training window, enable weekend sessions, reduce class sizes, or increase the number of training rooms.`;
              })()}/>
            <MetricTile label="Optimisation Delta"
              display={m?.compression_percent??0} unit="%" spark={compH} color={DS.t600} accent={DS.t400}
              sub={m?.compression_percent&&m.compression_percent>0?`${m.compression_percent}% fewer training days`:undefined}
              tooltip="The percentage reduction in total employee-training-days between the chaotic planned schedule and the optimised one. A delta of 70% means the optimiser consolidated the same training into 70% fewer calendar days — dramatically reducing business disruption and cost."/>
            <MetricTile label="Training Hours"
              display={m?.remaining_hours!=null?Number(m.remaining_hours).toFixed(0):"0"} unit="h" color={DS.z500} accent={DS.z400}
              tooltip="The total sum of all training hours across all employees — calculated as: Σ (course duration × number of enrolled employees). This represents the total learning investment required by the organisation across the entire training window."/>
            {(()=>{
              const parts=m?.estimated_manual_hours!=null?fmtHoursParts(m.estimated_manual_hours):{v:"0",u:"h"};
              return(
                <MetricTile label="Effort to Schedule"
                  display={parts.v} unit={parts.u} color={DS.violet} accent={DS.violet}
                  tooltip="An estimate of the manual scheduling effort this tool replaces. Calculated as: (total enrolments × 8 min per booking) + (employee count × 15 min for constraint-checking) = total person-hours. A typical 500-person programme with 60 courses would require ~30 person-weeks of manual coordination work."/>
              );
            })()}
          </div>

        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{flex:1,display:"flex",overflow:"hidden",position:"relative",zIndex:1}}>

        {/* ── PARAMETER SIDECAR ── */}
        {sidecar&&(
          <aside style={{
            width:244,flexShrink:0,
            background:"rgba(255,252,247,0.18)",
            backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
            borderRight:`1px solid rgba(255,255,255,0.22)`,
            overflowY:"auto",
            animation:"wrs-spring 0.25s cubic-bezier(0.34,1.56,0.64,1)",
            display:"flex",flexDirection:"column",
          }}>
            <div style={{padding:"10px 12px 8px",borderBottom:`1px solid rgba(230,225,215,0.5)`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{padding:"3px 11px",borderRadius:7,background:DS.z900,flexShrink:0}}>
                  <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,fontWeight:700,color:"white",letterSpacing:"-0.01em"}}>Create Synthetic Data</span>
                </div>
              </div>
              <button onClick={()=>setSidecar(false)}
                style={{width:22,height:22,borderRadius:6,background:"rgba(255,255,255,0.6)",border:`1px solid rgba(210,205,200,0.6)`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:DS.z500,fontSize:11,fontWeight:700}}>
                ✕
              </button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"10px 12px 80px"}}>
              <Accordion title="Time" icon="📅">
                <SideDateInput label="Start Date" value={prof.start_date} min={today} max={maxStart}
                  onChange={v=>setProf(p=>({...p,start_date:v,end_date:addDays(v,Math.max(14,Math.min(90,daysBetween(v,p.end_date))))}))}/>
                <SideDateInput label="End Date"   value={prof.end_date}   min={minEnd} max={maxEnd} onChange={v=>setProf(p=>({...p,end_date:v}))}/>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:`${DS.i500}09`,border:`1px solid ${DS.i200}`,borderRadius:9,marginBottom:10}}>
                  <span style={{fontFamily:"'Geist Mono',monospace",fontSize:10,color:DS.z500}}>Window</span>
                  <span style={{fontFamily:"'Geist Mono',monospace",fontSize:10,color:DS.i600,fontWeight:600}}>{windowDays} days</span>
                </div>
                {/* Sat / Sun toggles */}
                <div style={{display:"flex",gap:6,marginBottom:12}}>
                  {([["Sat",prof.allow_saturday,"allow_saturday"],["Sun",prof.allow_sunday,"allow_sunday"]] as [string,boolean,string][]).map(([label,on,field])=>(
                    <button key={field} onClick={()=>setProf(p=>({...p,[field]:!on}))}
                      style={{flex:1,padding:"6px 0",borderRadius:8,border:`1.5px solid ${on?DS.i400:DS.z300}`,background:on?DS.i50:"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"'Geist Mono',monospace",fontSize:10,fontWeight:700,color:on?DS.i600:DS.z500,transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:on?DS.i500:DS.z300,display:"inline-block",boxShadow:on?`0 0 6px ${DS.i500}88`:"none",flexShrink:0}}/>
                      {label} {on?"ON":"OFF"}
                    </button>
                  ))}
                </div>
                <div style={{display:"flex",gap:8,marginBottom:4}}>
                  <SideHourSelect label="Day Start" value={prof.day_start_hour} options={startHrs} onChange={v=>setProf(p=>({...p,day_start_hour:v,day_end_hour:Math.max(v+1,p.day_end_hour)}))}/>
                  <SideHourSelect label="Day End"   value={prof.day_end_hour}   options={endHrs}   onChange={v=>setProf(p=>({...p,day_end_hour:v}))}/>
                </div>
              </Accordion>

              <div style={{height:8}}/>
              <Accordion title="Workforce" icon="👥">
                <SideSlider label="Employees" field="employees" min={10} max={500} value={prof.employees} onChange={(f,v)=>setProf(p=>({...p,[f]:v}))}/>
                <SideSlider label="Roles"     field="roles"     min={3}  max={50}  value={prof.roles}     onChange={(f,v)=>setProf(p=>({...p,[f]:v}))}/>
                <SideSlider label="Courses"   field="courses"   min={5}  max={60}  value={prof.courses}   onChange={(f,v)=>setProf(p=>({...p,[f]:v}))}/>
              </Accordion>

              <div style={{height:8}}/>
              <Accordion title="Shift Patterns" icon="🔄">
                {SHIFT_DEFS.map(def=>{
                  const sid=def.id as ShiftId;
                  const on=shiftEnabled[sid];
                  const pct=shiftSplit[sid];
                  const enabledCount=Object.values(shiftEnabled).filter(Boolean).length;
                  return(
                    <div key={sid} style={{marginBottom:10,borderRadius:10,border:`1.5px solid ${on?DS.i200:"rgba(255,255,255,0.4)"}`,background:on?"rgba(238,242,255,0.55)":"rgba(255,255,255,0.30)",overflow:"hidden",transition:"all 0.2s"}}>
                      {/* Header row */}
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",cursor:def.always?"default":"pointer"}} onClick={()=>!def.always&&setShiftEnabled(p=>({...p,[sid]:!on}))}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:on?DS.i500:DS.z300,boxShadow:on?`0 0 8px ${DS.i500}88`:"none",flexShrink:0,transition:"all 0.2s"}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,fontWeight:700,color:on?DS.z900:DS.z600,lineHeight:1.2}}>{def.name}</div>
                          <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:on?DS.i600:DS.z400,marginTop:1}}>{def.shortName} · {def.hoursPerShift}h shifts</div>
                        </div>
                        {def.always&&<span style={{fontFamily:"'Geist Mono',monospace",fontSize:7,color:DS.i500,background:DS.i50,border:`1px solid ${DS.i200}`,borderRadius:4,padding:"1px 5px",flexShrink:0}}>MAIN</span>}
                        {!def.always&&<div style={{width:28,height:16,borderRadius:8,background:on?DS.i500:DS.z300,position:"relative",flexShrink:0,transition:"background 0.2s"}}>
                          <div style={{position:"absolute",top:2,left:on?14:2,width:12,height:12,borderRadius:"50%",background:"white",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
                        </div>}
                      </div>
                      {/* Details when enabled */}
                      {on&&<div style={{padding:"0 10px 10px"}}>
                        <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z500,lineHeight:1.7,marginBottom:6}}>{def.category}<br/>{def.daysLabel} · {def.cycleLength}d cycle · {def.teams}</div>
                        {/* Employee % split slider — only show for optional patterns with at least one other enabled */}
                        {!def.always&&enabledCount>1&&(
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                              <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z500}}>Employee share</span>
                              <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.i600,fontWeight:600}}>{pct}%</span>
                            </div>
                            <input type="range" min={5} max={80} step={5} value={pct}
                              onChange={e=>setShiftSplit(p=>({...p,[sid]:parseInt(e.target.value)}))}
                              style={{width:"100%",accentColor:DS.i500,cursor:"pointer",height:16}}/>
                          </div>
                        )}
                      </div>}
                    </div>
                  );
                })}
                <div style={{padding:"7px 10px",background:"rgba(238,242,255,0.45)",border:`1px solid ${DS.i100}`,borderRadius:8,marginTop:2}}>
                  <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z500,lineHeight:1.7}}>
                    Active patterns: <strong style={{color:DS.i600}}>{Object.values(shiftEnabled).filter(Boolean).length}</strong><br/>
                    Employees assigned proportionally by share %
                  </div>
                </div>
              </Accordion>

              <div style={{height:8}}/>
              <Accordion title="Learning" icon="🎓" open={false}>
                <SideSlider label="Rel. Density" field="relationship_density" min={0.1} max={1.0} step={0.1} value={prof.relationship_density} onChange={(f,v)=>setProf(p=>({...p,[f]:v}))}/>
                <SideSlider label="Max Classroom Size" field="max_classroom" min={10} max={30} step={1} value={prof.max_classroom} onChange={(f,v)=>setProf(p=>({...p,[f]:v}))}/>

                {/* Trainers / Rooms toggle */}
                <div style={{marginBottom:10}}>
                  <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z500,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>Training Rooms & Trainers</div>
                  <div style={{display:"flex",gap:4}}>
                    {([1,2] as const).map(n=>(
                      <button key={n} onClick={()=>setNumTrainers(n)}
                        style={{
                          flex:1,padding:"7px 4px",borderRadius:8,cursor:"pointer",
                          fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,fontWeight:700,
                          border:`1.5px solid ${numTrainers===n?DS.i400:DS.z200}`,
                          background:numTrainers===n?DS.i50:"rgba(255,255,255,0.4)",
                          color:numTrainers===n?DS.i600:DS.z500,
                          transition:"all 0.15s",
                        }}>
                        {n === 1 ? "1 Room" : "2 Rooms"}
                        <div style={{fontFamily:"'Geist Mono',monospace",fontSize:7,color:numTrainers===n?DS.i500:DS.z400,marginTop:2}}>
                          {n === 1 ? "1 Trainer" : "2 Trainers"}
                        </div>
                      </button>
                    ))}
                  </div>
                  {numTrainers===2&&(
                    <div style={{marginTop:5,fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.t600,lineHeight:1.5}}>
                      Canvas splits each day into teal (Room 1) + violet (Room 2) lanes after optimising.
                    </div>
                  )}
                </div>

                <div style={{padding:"6px 10px",background:"rgba(255,253,249,0.45)",border:`1px solid rgba(255,255,255,0.45)`,borderRadius:8,marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z500}}>Daily hours</span>
                    <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.t600,fontWeight:600}}>{prof.day_end_hour-prof.day_start_hour}h</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z500}}>Solver</span>
                    <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.i500,fontWeight:600}}>OR-Tools CP-SAT</span>
                  </div>
                </div>
              </Accordion>

              {tm&&<>
                <div style={{height:8}}/>
                <Accordion title="Active Model" icon="⚡" open={false}>
                  {[["Hours",`${tm.day_start_hour}:00 – ${tm.day_end_hour}:00`],["Window",`${tm.training_window_days} days`],["Slots/day",tm.slots_per_day],["Phase",snap?.phase??"—"]].map(([k,v])=>(
                    <div key={k as string} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${DS.z100}`}}>
                      <span style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:DS.z400}}>{k}</span>
                      <span style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:DS.z700,fontWeight:600}}>{v}</span>
                    </div>
                  ))}
                  {sim&&(
                    <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}>
                      <span style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:DS.z400}}>Run ID</span>
                      <span style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:DS.i600,fontWeight:600,letterSpacing:"0.06em"}}>{sim.simulation_id.slice(0,8).toUpperCase()}</span>
                    </div>
                  )}
                </Accordion>
              </>}
            </div>
          </aside>
        )}

        {/* Show-config button when sidecar is hidden */}
        {!sidecar&&(
          <div style={{flexShrink:0,display:"flex",alignItems:"flex-start",padding:"10px 6px 0"}}>
            <button onClick={()=>setSidecar(true)}
              style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,0.55)",backdropFilter:"blur(12px)",border:`1px solid rgba(210,205,200,0.55)`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:DS.i600,fontSize:13,fontWeight:700,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
              ☰
            </button>
          </div>
        )}

        {/* ── TIMELINE CANVAS ── */}
        <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,padding:"8px 10px 0 8px",position:"relative"}}>

          {/* Trainer mismatch warning — user changed rooms toggle without re-simulating */}
          {snap&&numTrainers!==simNumTrainers&&(
            <div style={{
              flexShrink:0,padding:"5px 12px",
              background:"rgba(245,158,11,0.12)",border:`1px solid ${DS.amber}44`,
              borderRadius:8,marginBottom:4,
              display:"flex",alignItems:"center",justifyContent:"space-between",
              fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:"#92400E",
            }}>
              <span>⚠ Room setting changed — click <strong>Simulate Data</strong> to regenerate with {numTrainers} room{numTrainers===1?"":"s"}.</span>
              <button onClick={()=>setNumTrainers(simNumTrainers)} style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.amber,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>revert</button>
            </div>
          )}

          {/* ── COMBINED HEADER BAR: zoom controls (top) + days/dates (bottom) ── */}
          <div style={{
            flexShrink:0,
            background:"rgba(255,255,255,0.55)",
            backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
            border:`1px solid rgba(255,255,255,0.45)`,
            borderBottom:"none",
            borderRadius:"12px 12px 0 0",
            boxShadow:"0 -1px 0 rgba(255,255,255,0.6) inset",
          }}>
            {/* Row 1: zoom controls — rightmost, full width */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"5px 10px 4px",gap:4}}>
              <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z500,fontWeight:600,letterSpacing:"0.08em",marginRight:4}}>ZOOM</span>
              {([0.5,1,1.5,2,3] as const).map(z=>(
                <button key={z} onClick={()=>setZoom(z)}
                  style={{
                    minWidth:28,height:22,padding:"0 5px",borderRadius:6,cursor:"pointer",
                    fontFamily:"'Geist Mono',monospace",fontSize:9,fontWeight:700,
                    background:zoom===z?DS.i500:"rgba(255,255,255,0.45)",
                    border:`1px solid ${zoom===z?DS.i500:"rgba(200,200,210,0.6)"}`,
                    color:zoom===z?"white":DS.z600,
                    transition:"all 0.12s",
                  }}>
                  {z===1?"1×":z<1?`${z}×`:`${z}×`}
                </button>
              ))}
              {isOpt&&numTrainers===2&&(
                <>
                  <div style={{width:1,height:18,background:DS.z150,marginLeft:6}}/>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:7,height:7,borderRadius:2,background:DS.t500,flexShrink:0}}/>
                    <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z600,fontWeight:600,whiteSpace:"nowrap"}}>Room 1</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:7,height:7,borderRadius:2,background:"#7C3AED",flexShrink:0}}/>
                    <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.z600,fontWeight:600,whiteSpace:"nowrap"}}>Room 2</span>
                  </div>
                </>
              )}
            </div>

            {/* Row 2: day letters + date labels — scrolls with canvas */}
            <div ref={xAxisRef} style={{overflowX:"hidden",borderTop:`1px solid rgba(220,215,210,0.35)`}}>
              {snap&&proj?(
                <div style={{width:YM+proj.days*cwZ,position:"relative",height:38}}>
                  {/* Y-axis margin spacer */}
                  <div style={{position:"absolute",left:0,top:0,width:YM,height:"100%"}}/>
                  {/* Day cells */}
                  <div style={{position:"absolute",left:YM,top:0,height:22,display:"flex"}}>
                    {dayInfos.map(({d,letter,isWeekend:we,dow})=>{
                      const disabled=(dow===6&&!prof.allow_saturday)||(dow===0&&!prof.allow_sunday);
                      return(
                        <div key={d} style={{
                          width:cwZ,height:22,flexShrink:0,
                          display:"flex",alignItems:"center",justifyContent:"center",gap:0,
                          background:disabled?"rgba(160,160,175,0.07)":we?"rgba(99,102,241,0.05)":"transparent",
                          borderRight:"1px solid rgba(200,200,210,0.18)",
                        }}>
                          {isOpt&&numTrainers===2?(
                            <>
                              {[0,1].map(rm=>(
                                <div key={rm} style={{flex:1,height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
                                  borderRight:rm===0?`1px dashed rgba(150,140,180,0.25)`:"none"}}>
                                  <div style={{width:5,height:5,borderRadius:"50%",
                                    background:rm===0?DS.t500:"#7C3AED",opacity:disabled?0.2:0.65}}/>
                                </div>
                              ))}
                            </>
                          ):(
                            <span style={{
                              fontFamily:"'Geist Mono',monospace",fontSize:9,fontWeight:700,
                              color:disabled?DS.z300:we?DS.i500:DS.z600,
                              textDecoration:disabled?"line-through":"none",
                            }}>{letter}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Date labels */}
                  <div style={{position:"absolute",left:YM,top:22,height:16}}>
                    {dayInfos.filter(({d,isMon})=>d===0||isMon).map(({d,dayNum,month})=>(
                      <div key={d} style={{position:"absolute",left:d*cwZ+2,
                        fontFamily:"'Geist Mono',monospace",fontSize:8,fontWeight:500,
                        color:DS.z600,whiteSpace:"nowrap",lineHeight:"16px"}}>
                        {dayNum} {month}
                      </div>
                    ))}
                  </div>
                </div>
              ):<div style={{height:38}}/>}
            </div>
          </div>

          {/* ── CANVAS SCROLL CONTAINER ── */}
          <div style={{
              flex:1,overflowX:"auto",overflowY:"auto",
              borderRadius:"0 0 14px 14px",
              border:`1px solid rgba(255,255,255,0.45)`,
              borderTop:`1px solid rgba(220,215,210,0.35)`,
              background:"rgba(255,255,255,0.38)",
              backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",
              boxShadow:"0 4px 40px rgba(120,80,20,0.10), 0 1px 0 rgba(255,255,255,0.7) inset",
              cursor:snap?"crosshair":"default",
              position:"relative",
            }}
            onScroll={e=>{if(xAxisRef.current) xAxisRef.current.scrollLeft=(e.target as HTMLDivElement).scrollLeft;}}
          >
            {!snap?(
              <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,position:"relative"}}>
                <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.3}} xmlns="http://www.w3.org/2000/svg">
                  <defs><pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="0.8" fill={DS.z300}/></pattern></defs>
                  <rect width="100%" height="100%" fill="url(#dots)"/>
                </svg>
                <div style={{position:"relative",textAlign:"left",maxWidth:480,padding:"0 24px",marginTop:"-8vh"}}>
                  <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:20,fontWeight:700,color:DS.z800,marginBottom:18,letterSpacing:"-0.02em",textAlign:"center"}}>Your Dynamic Training Canvas</div>
                  <div style={{display:"flex",flexDirection:"column",gap:9}}>
                    {/* Step 1 */}
                    <div style={{display:"flex",alignItems:"center",gap:14,background:"rgba(255,255,255,0.60)",borderRadius:12,padding:"11px 16px",border:`1px solid rgba(255,255,255,0.7)`,backdropFilter:"blur(16px)"}}>
                      <div style={{flexShrink:0,padding:"7px 16px",borderRadius:9,background:DS.z900,
                        fontFamily:"'Geist',system-ui,sans-serif",fontSize:12,fontWeight:700,color:"white",
                        whiteSpace:"nowrap",userSelect:"none"}}>
                        Create Synthetic Data
                      </div>
                      <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,color:DS.z600,lineHeight:1.5}}>
                        Open <strong style={{color:DS.z800}}>Create Synthetic Data</strong> panel and configure your workforce parameters.
                      </span>
                    </div>
                    {/* Step 2 */}
                    <div style={{display:"flex",alignItems:"center",gap:14,background:"rgba(255,255,255,0.60)",borderRadius:12,padding:"11px 16px",border:`1px solid rgba(255,255,255,0.7)`,backdropFilter:"blur(16px)"}}>
                      <div style={{flexShrink:0,padding:"7px 16px",borderRadius:9,
                        background:"transparent",border:`1.5px solid ${DS.i200}`,
                        fontFamily:"'Geist',system-ui,sans-serif",fontSize:12,fontWeight:700,color:DS.i600,
                        whiteSpace:"nowrap",userSelect:"none"}}>
                        ◌ Simulate Data
                      </div>
                      <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,color:DS.z600,lineHeight:1.5}}>
                        Generate a synthetic workforce schedule — the <em style={{color:DS.i500}}>chaotic unoptimised state</em>.
                      </span>
                    </div>
                    {/* Step 3 */}
                    <div style={{display:"flex",alignItems:"center",gap:14,background:"rgba(255,255,255,0.60)",borderRadius:12,padding:"11px 16px",border:`1px solid rgba(255,255,255,0.7)`,backdropFilter:"blur(16px)"}}>
                      <div style={{flexShrink:0,padding:"7px 16px",borderRadius:9,
                        background:`linear-gradient(135deg,${DS.i500},${DS.t500})`,
                        fontFamily:"'Geist',system-ui,sans-serif",fontSize:12,fontWeight:700,color:"white",
                        opacity:0.5,whiteSpace:"nowrap",userSelect:"none"}}>
                        ⚡ Optimize Schedule
                      </div>
                      <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:11,color:DS.z600,lineHeight:1.5}}>
                        Run CP-SAT optimisation to find the best possible training schedule.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ):(
              <canvas ref={canvasRef} onClick={handleClick} onMouseMove={handleMove} onMouseLeave={clearHov} style={{display:"block",height:"100%"}}/>
            )}
          </div>

        </main>

        {/* ── RIGHT INSPECTOR ── */}
        {snap&&(
          <aside style={{
            width:268,flexShrink:0,
            background:"rgba(255,252,247,0.52)",
            backdropFilter:"blur(32px)",WebkitBackdropFilter:"blur(32px)",
            borderLeft:`1px solid rgba(255,255,255,0.50)`,
            padding:10,overflowY:"auto",
            display:"flex",flexDirection:"column",gap:8,
          }}>
            {/* Active inspector content */}
            {selEmp&&proj&&<EmployeeInspector empId={selEmp} proj={proj} snap={snap} onClose={()=>{setSelEmp(null);}}/>}
            {selCell&&selData&&proj&&!selEmp&&<CellInspector cell={selCell} data={selData} tm={snap.time_model} nodeMap={proj.nodeMap} onClose={()=>{setSelCell(null);setSelEmp(null);}} prof_max_classroom={prof.max_classroom} phase={snap.phase} room={selCell.room??0} numTrainers={numTrainers}/>}

            {/* Overflow detail panel — shown when Readiness Score is clicked */}
            {showOverflowPanel&&!selCell&&!selEmp&&proj&&proj.overflowCount>0&&(
              <div style={{borderRadius:12,overflow:"hidden",border:`1.5px solid ${DS.red}33`,background:"rgba(255,241,242,0.80)",animation:"wrs-fadein 0.2s ease"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderBottom:`1px solid ${DS.red}18`}}>
                  <div>
                    <div style={{fontFamily:"'Geist Mono',monospace",fontSize:9,fontWeight:700,color:DS.red,letterSpacing:"0.10em",textTransform:"uppercase"}}>Unscheduled Training</div>
                    <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:"#9F1239",marginTop:2}}>
                      {proj.overflowCount} placements · {snap.placements.filter(p=>p.overflow).map(p=>p.employee_id).filter((v,i,a)=>a.indexOf(v)===i).length} employees affected
                    </div>
                  </div>
                  <button onClick={()=>setShowOverflowPanel(false)} style={{width:24,height:24,borderRadius:6,background:"rgba(255,255,255,0.6)",border:`1px solid ${DS.red}33`,cursor:"pointer",color:DS.red,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                </div>
                <div style={{padding:"6px 10px 6px",fontFamily:"'Geist',system-ui,sans-serif",fontSize:9,color:"#7F1D1D",lineHeight:1.65,background:"rgba(255,220,220,0.3)"}}>
                  These employees require training that couldn't fit in the {snap.time_model.training_window_days}-day window. Extend the window, enable weekends, or increase training rooms to resolve.
                </div>
                <div style={{padding:"8px 10px 10px",display:"flex",flexDirection:"column",gap:4,maxHeight:380,overflowY:"auto"}}>
                  {(()=>{
                    const byEmp=new Map<string,{label:string;courses:{label:string;hours:number}[]}>();
                    for(const p of snap.placements){
                      if(!p.overflow) continue;
                      const el=proj.nodeMap[p.employee_id]?.label??p.employee_id;
                      const cl=proj.nodeMap[p.course_id]?.label??p.course_id;
                      if(!byEmp.has(p.employee_id)) byEmp.set(p.employee_id,{label:el,courses:[]});
                      byEmp.get(p.employee_id)!.courses.push({label:cl,hours:p.duration_slots/4});
                    }
                    return [...byEmp.entries()].sort((a,b)=>a[1].label.localeCompare(b[1].label)).map(([eid,{label,courses}])=>(
                      <div key={eid} style={{padding:"7px 10px",background:"rgba(255,255,255,0.6)",border:`1px solid ${DS.red}22`,borderRadius:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:DS.z800,fontWeight:700}}>{label}</span>
                          <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.red,fontWeight:600,flexShrink:0,marginLeft:6}}>{courses.length} missing</span>
                        </div>
                        {courses.map((c,i)=>(
                          <div key={i} style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:"#9F1239",lineHeight:1.6,
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            · {c.label} ({c.hours}h)
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* Drill-down hint when cell is selected */}
            {selCell&&!selEmp&&(
              <div style={{padding:"8px 10px",background:"rgba(238,242,255,0.75)",border:`1px solid ${DS.i200}`,borderRadius:9}}>
                <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.i600,lineHeight:1.9,fontWeight:500}}>
                  💡 <strong>Click a · dot</strong> in this block<br/>to focus on an employee
                </div>
              </div>
            )}

            {/* Complexity badge — shown after generate, before solve */}
            {complexity&&status==="generated"&&(
              <div style={{padding:"10px 12px",background:"rgba(238,242,255,0.65)",border:`1px solid ${DS.i100}`,borderRadius:12,animation:"wrs-fadein 0.3s ease"}}>
                <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.i600,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",marginBottom:6}}>Problem Complexity</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:13,color:DS.z900,fontWeight:700}}>{complexity.complexity_label}</span>
                  <span style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:DS.z500,background:"rgba(255,255,255,0.7)",padding:"2px 7px",borderRadius:6,border:`1px solid ${DS.z200}`}}>~{complexity.estimated_seconds.toFixed(0)}s</span>
                </div>
                <div style={{height:3,background:"rgba(0,0,0,0.08)",borderRadius:2,overflow:"hidden",marginBottom:6}}>
                  <div style={{height:"100%",width:`${complexity.complexity_score}%`,background:`linear-gradient(90deg,${DS.t400},${DS.i500})`,borderRadius:2}}/>
                </div>
                <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:9,color:DS.z600,lineHeight:1.6}}>
                  {complexity.drivers.num_sessions} sessions · {complexity.drivers.num_employees} employees · {complexity.drivers.window_days}-day window
                </div>
                {complexity.suggest_deep_solve&&(
                  <div style={{marginTop:6,padding:"5px 8px",background:"rgba(99,102,241,0.08)",border:`1px solid ${DS.i200}`,borderRadius:7}}>
                    <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:9,color:DS.i700,lineHeight:1.5}}>
                      ⚡ Complex problem — the 30s fast solve may return a <em>feasible</em> result. Use <strong>Continue →Optimal</strong> after optimising for a proven best solution.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Post-solve feasible prompt — shown when result is not yet optimal */}
            {status==="solved"&&solveMetadata&&!solveMetadata.is_optimal&&!deepSolving&&(
              <div style={{padding:"10px 12px",background:"rgba(245,243,255,0.80)",border:`1px solid ${DS.i200}`,borderRadius:12,animation:"wrs-fadein 0.3s ease"}}>
                <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.i600,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",marginBottom:6}}>Result: Feasible</div>
                <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:DS.z700,lineHeight:1.6,marginBottom:8}}>
                  The 30s solve found a good schedule but hasn't proven it's the <em>best possible</em>.
                  {solveMetadata.gap_percent!=null&&<> The solution is within <strong style={{color:DS.i600}}>{solveMetadata.gap_percent.toFixed(1)}%</strong> of optimal.</>}
                </div>
                <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:9,color:DS.z600,lineHeight:1.5}}>
                  Click <strong style={{color:DS.i600}}>Continue →Optimal</strong> in the dock to keep solving
                  {complexity&&<> for up to <strong>~{Math.round(complexity.estimated_seconds)}s</strong></>} until a proven optimal solution is found.
                </div>
              </div>
            )}

            {/* Optimal result confirmation */}
            {status==="solved"&&solveMetadata?.is_optimal&&(
              <div style={{padding:"10px 12px",background:"rgba(240,253,250,0.80)",border:`1px solid ${DS.t400}55`,borderRadius:12,animation:"wrs-fadein 0.3s ease"}}>
                <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.t600,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",marginBottom:5}}>✓ Optimal Solution</div>
                <div style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:DS.z700,lineHeight:1.6}}>
                  CP-SAT has mathematically proven this is the best possible schedule. No better solution exists within these constraints.
                </div>
              </div>
            )}

            {/* How-to hint when nothing is selected */}
            {!selCell&&!selEmp&&(
              <div style={{padding:"12px",background:"rgba(238,242,255,0.65)",border:`1px solid ${DS.i100}`,borderRadius:12}}>
                <div style={{fontFamily:"'Geist Mono',monospace",fontSize:8,color:DS.i600,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7}}>How to explore</div>
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {[
                    ["①","Click any coloured block on the timeline to inspect courses and trainees."],
                    ["②","Click a · dot inside a block to open the employee focus view."],
                    ["③","Zoom in (0.5×–3×) to make individual employee dots easier to click."],
                  ].map(([n,t])=>(
                    <div key={n} style={{display:"flex",gap:7,alignItems:"flex-start"}}>
                      <span style={{fontFamily:"'Geist Mono',monospace",fontSize:10,color:DS.i500,fontWeight:700,flexShrink:0,lineHeight:1.5}}>{n}</span>
                      <span style={{fontFamily:"'Geist',system-ui,sans-serif",fontSize:10,color:DS.z700,lineHeight:1.55}}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Overflow bucket */}
            {proj&&proj.overflowCount>0&&(
              <OverflowBucket count={proj.overflowCount} proj={proj} snap={snap}/>
            )}
          </aside>
        )}
      </div>

      {/* ── FLOATING COMMAND DOCK — centred over the timeline canvas ── */}
      <div style={{
        position:"fixed",bottom:20,
        // Left edge = sidecar width (if open) + show-config btn width (if closed); centred in remaining space
        left: sidecar ? `calc(244px + (100vw - 244px) / 2)` : `calc((100vw) / 2)`,
        transform:"translateX(-50%)",
        zIndex:50,
        display:"flex",alignItems:"center",gap:6,
        padding:"7px 10px",
        background:"rgba(255,252,248,0.60)",
        backdropFilter:"blur(32px)",WebkitBackdropFilter:"blur(32px)",
        borderRadius:22,
        border:`1px solid rgba(255,255,255,0.96)`,
        boxShadow:"0 8px 32px rgba(180,120,50,0.12), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(240,225,200,0.5), 0 1px 0 rgba(255,255,255,1) inset",
        transition:"left 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* Status pip */}
        <div style={{display:"flex",alignItems:"center",gap:5,paddingRight:10,borderRight:`1px solid ${DS.z150}`}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:statusColors[status],boxShadow:`0 0 8px ${statusColors[status]}88`,animation:isActive?"wrs-pulse 1s infinite":"none"}}/>
          <span style={{fontFamily:"'Geist Mono',monospace",fontSize:10,color:DS.z600,fontWeight:500,letterSpacing:"0.05em"}}>{statusLabels[status].toUpperCase()}</span>
        </div>

        {/* Ghost btn */}
        <DockBtn label="◌  Simulate Data" onClick={generate} disabled={isActive} ghost/>
        {/* Divider */}
        <div style={{width:1,height:24,background:DS.z150}}/>

        {/* PRIMARY ACTION BUTTON — transforms based on state */}
        {deepSolving ? (
          // While deep-solving: show "Good enough, stop here" button
          <DockBtn
            label={
              <span style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:"white",display:"inline-block",animation:"wrs-pulse 1s infinite",flexShrink:0}}/>
                <span>Good enough — stop here</span>
              </span>
            }
            onClick={stopDeepSolve}
            wide
          />
        ) : status==="solved" && solveMetadata && !solveMetadata.is_optimal && !deepSolveStopped ? (
          // After feasible solve (and not stopped): show Continue →Optimal with estimated time
          <DockBtn
            label={
              <span style={{display:"flex",alignItems:"center",gap:7}}>
                <span>⏳ Continue →Optimal</span>
                {complexity&&(
                  <span style={{
                    fontFamily:"'Geist Mono',monospace",fontSize:9,
                    opacity:0.75,fontWeight:400,
                    background:"rgba(255,255,255,0.20)",
                    padding:"1px 6px",borderRadius:5,
                  }}>
                    ~{Math.round(complexity.estimated_seconds)}s
                  </span>
                )}
              </span>
            }
            onClick={deepSolve}
            wide
          />
        ) : status==="solved" && solveMetadata && !solveMetadata.is_optimal && deepSolveStopped ? (
          // After user clicked "Good enough" — grey out, no further action
          <DockBtn label="✓ Stopped — simulate to restart" onClick={()=>{}} disabled wide/>
        ) : (
          // Default: Optimize Schedule
          <DockBtn label="⚡  Optimize Schedule" onClick={solve} disabled={!sim||isActive} wide/>
        )}

      </div>

      {/* ── SOLVER MESSAGE POPUP — centred overlay while solving ── */}
      {solverMsg&&(
        <div style={{
          position:"fixed",inset:0,zIndex:200,
          display:"flex",alignItems:"center",justifyContent:"center",
          pointerEvents:"none",
        }}>
          <div style={{
            background:"rgba(8,6,20,0.92)",
            backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",
            border:"1px solid rgba(255,255,255,0.12)",
            borderRadius:20,padding:"28px 40px",
            maxWidth:460,textAlign:"center",
            boxShadow:"0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(99,102,241,0.2)",
          }}>
            {/* Pulsing dots */}
            <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:18}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{
                  width:7,height:7,borderRadius:"50%",
                  background:`linear-gradient(135deg,${DS.i400},${DS.t400})`,
                  animation:`wrs-pulse 1.2s ease-in-out ${i*0.2}s infinite`,
                }}/>
              ))}
            </div>
            {/* Message — re-animate on change via key */}
            <div key={solverMsg} style={{
              fontFamily:"'Geist',system-ui,sans-serif",
              fontSize:17,fontWeight:700,color:"white",
              letterSpacing:"-0.02em",lineHeight:1.4,
              marginBottom:14,
              animation:"wrs-fadein 0.35s ease",
            }}>
              {solverMsg}
            </div>
            {/* Progress bar */}
            <div style={{height:3,background:"rgba(255,255,255,0.12)",borderRadius:2,overflow:"hidden",marginBottom:10}}>
              <div style={{
                height:"100%",width:`${Math.round((solveProgress??0)*100)}%`,
                background:`linear-gradient(90deg,${DS.i400},${DS.t400})`,
                borderRadius:2,transition:"width 0.1s linear",
              }}/>
            </div>
            {/* Timer — countdown for fast solve, elapsed/estimated for deep solve */}
            <div style={{fontFamily:"'Geist Mono',monospace",fontSize:11,color:"rgba(255,255,255,0.38)",letterSpacing:"0.04em"}}>
              {deepSolving
                ? `${(live/1000).toFixed(1)}s elapsed · ~${Math.round(currentTimeLimitRef.current)}s estimated`
                : `${Math.max(0,SOLVE_LIMIT_S-(live/1000)).toFixed(1)}s remaining`
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
