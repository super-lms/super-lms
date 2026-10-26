export const cad=cents=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(Number(cents||0)/100)
export const shares=units=>Number(units||0)/1000000
export const sharePrice=units=>Number(units||0)/10000
export function orderTotal(orders){
 try{return orders.reduce((total,o)=>{if(!/^\d+(\.\d{1,6})?$/.test(String(o.quantity))||!/^\d+(\.\d{1,4})?$/.test(String(o.price)))return NaN;const units=(s,n)=>{const[w,f='']=String(s).split('.');return BigInt(w)*10n**BigInt(n)+BigInt(f.padEnd(n,'0'))};const gross=Number((units(o.quantity,6)*units(o.price,4)+50000000n)/100000000n);return total+gross+1000},0)}catch{return NaN}
}
export function stockGameTables(game,portfolio){
 const p=portfolio,snapshot=p.valuations.find(v=>v.price_date===game.valuation_date),current=snapshot?.trade_count===p.state.trade_count,v=current?snapshot?.snapshot:null
 return [
  {name:'Account Summary',rows:[['Stock Market Accounting Game',game.title],['Currency','CAD'],['Starting capital',100000],['Current cash',p.state.cash_cents/100],['Trade fees paid',p.state.fees_cents/100],['Realized gain or loss',p.state.realized_cents/100],['Valuation date',snapshot?.price_date||'Not entered'],['Valuation status',current?'Current':'Fresh valuation needed'],['Investment market value',v?v.investments_cents/100:null],['Assets',v?v.assets_cents/100:null],['Liabilities',v?v.liabilities_cents/100:null],['Equity',v?v.equity_cents/100:null],['Price status','Student-entered prices; teacher review required for final results']]},
  {name:'Bank and Transactions',rows:[['Date','Type','Symbol','Shares','CAD price','Trade value CAD','Fee CAD','Cash movement CAD','Cash balance CAD','Price date','Source','Trade reason'],[p.player.joined_at,'OPENING CAPITAL','','','','',0,100000,100000,'','',''],...p.transactions.map(t=>[t.created_at,t.side,t.symbol,shares(t.quantity_units),sharePrice(t.price_units),t.gross_cents/100,t.fee_cents/100,(t.side==='BUY'?-t.gross_cents-t.fee_cents:t.gross_cents-t.fee_cents)/100,t.cash_after_cents/100,t.price_date,t.source_url,t.reason])]},
  {name:'Current Holdings',rows:[['Symbol','Shares','Book cost CAD including buy fees'],...Object.values(p.state.positions).map(h=>[h.symbol,shares(h.quantity_units),h.cost_cents/100])]},
  {name:'Daily Research',rows:[['Price date','Saved time','Symbol','Shares at valuation','CAD price','Value CAD','Explanation','Price source','Research source'],...p.valuations.flatMap(d=>d.snapshot.holdings.map(h=>[d.price_date,d.saved_at,h.symbol,shares(h.quantity_units),sharePrice(h.price_units),h.market_value_cents/100,h.explanation,h.source_url,h.research_url||'']))]},
  {name:'Weekly Statements',rows:[['Valuation date','Submitted time','Assets CAD','Liabilities CAD','Equity CAD','Reflection'],...p.reports.map(r=>[r.price_date,r.submitted_at,Number(r.assets_cents)/100,Number(r.liabilities_cents)/100,Number(r.equity_cents)/100,r.reflection])]}
 ]
}
export async function downloadStockWorkbook(game,portfolio){const XLSX=await import('xlsx'),book=XLSX.utils.book_new();for(const table of stockGameTables(game,portfolio)){const sheet=XLSX.utils.aoa_to_sheet(table.rows);sheet['!cols']=table.rows[0].map((_,i)=>({wch:i<3?24:20}));XLSX.utils.book_append_sheet(book,sheet,table.name)}XLSX.writeFile(book,`Stock-game-${game.id}-student-${portfolio.player.student_id}.xlsx`,{compression:true})}
export async function downloadStockTally(game,leaders){const XLSX=await import('xlsx'),book=XLSX.utils.book_new(),rows=[['Rank','Student','Price date','Cash CAD','Investments CAD','Liabilities CAD','Equity CAD','Gain or loss CAD','Valuation current','Teacher reviewed'],...leaders.map(p=>[p.rank??'',p.name,game.valuation_date,p.current?p.cash_cents/100:null,p.current?p.investments_cents/100:null,0,p.current?p.equity_cents/100:null,p.current?p.profit_cents/100:null,p.current?'Yes':'No',p.reviewed?'Yes':'No'])];XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'Class Tally');XLSX.writeFile(book,`Stock-game-${game.id}-tally.xlsx`,{compression:true})}
export function twoMonthEnd(start){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start||''))return ''
 const[y,m,d]=start.split('-').map(Number),target=new Date(Date.UTC(y,m+1,1)),last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate()
 target.setUTCDate(Math.min(d,last));return target.toISOString().slice(0,10)
}
