const CAPITAL=10000000,FEE=1000,SHARE_SCALE=1000000,PRICE_SCALE=10000;
function decimalUnits(value,places,label){
 const raw=String(value??'').trim();if(!new RegExp(`^\\d{1,10}(?:\\.\\d{1,${places}})?$`).test(raw))throw Error(`Enter a valid ${label} with up to ${places} decimal places.`);
 const [whole,fraction='']=raw.split('.'),units=BigInt(whole)*10n**BigInt(places)+BigInt(fraction.padEnd(places,'0'));
 if(units<=0n||units>BigInt(Number.MAX_SAFE_INTEGER))throw Error(`Enter a positive ${label}.`);return Number(units);
}
function rounded(n,d){return Number((BigInt(n)+BigInt(d)/2n)/BigInt(d));}
function amount(price,quantity){const n=(BigInt(price)*BigInt(quantity)+50000000n)/100000000n;if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Trade value is too large.');return Number(n);}
function ticker(value){const s=String(value||'').trim().toUpperCase();if(!/^[A-Z0-9][A-Z0-9._:-]{0,24}$/.test(s))throw Error('Enter a valid exchange-listed stock symbol, such as AAPL, RY.TO, 0700.HK, VOD.L, or TSE:7203.');return s;}
function source(value){let u;try{u=new URL(String(value||''));}catch{throw Error('Enter the web address where you found the stock price.');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.href.length>1500)throw Error('Enter a valid public price-source web address.');return u.href;}
function orderInput(o){
 if(!['BUY','SELL'].includes(o.side))throw Error('Choose Buy or Sell.');
 return {side:o.side,symbol:ticker(o.symbol),quantity_units:decimalUnits(o.quantity,6,'share quantity'),price_units:decimalUnits(o.price,4,'CAD-equivalent share price'),source_url:source(o.source_url),reason:String(o.reason||'').trim().slice(0,2000)};
}
function ledger(transactions=[]){
 const state={cash_cents:CAPITAL,fees_cents:0,realized_cents:0,positions:{},trade_count:0};
 for(const t of transactions)applyTrade(state,t);
 return state;
}
function applyTrade(state,t){
 const quantity=Number(t.quantity_units),price=Number(t.price_units),symbol=t.symbol;
 if(!Number.isSafeInteger(quantity)||quantity<=0||!Number.isSafeInteger(price)||price<=0)throw Error('Invalid trade quantity or price.');
 const gross=amount(price,quantity);if(gross<1)throw Error('Trade value must be at least one cent.');
 let p=state.positions[symbol];
 if(t.side==='BUY'){
  if(!p&&Object.keys(state.positions).length>=10)throw Error('You may hold at most 10 stocks. Sell an entire position before adding a different stock.');
  if(gross+FEE>state.cash_cents)throw Error('Not enough cash to pay for these shares and the $10 fee.');
  if(!p)p=state.positions[symbol]={symbol,quantity_units:0,cost_cents:0};
  if(!Number.isSafeInteger(p.quantity_units+quantity))throw Error('Share quantity is too large.');
  p.quantity_units+=quantity;p.cost_cents+=gross+FEE;if(!Number.isSafeInteger(p.cost_cents))throw Error('Investment book cost exceeds the supported range.');state.cash_cents-=gross+FEE;
 }else if(t.side==='SELL'){
  if(!p||quantity>p.quantity_units)throw Error('You cannot sell shares you do not own.');
  if(state.cash_cents+gross<FEE)throw Error('The sale proceeds and cash cannot cover the $10 fee.');
  const cost=quantity===p.quantity_units?p.cost_cents:rounded(BigInt(p.cost_cents)*BigInt(quantity),p.quantity_units);
  state.cash_cents+=gross-FEE;state.realized_cents+=gross-FEE-cost;p.quantity_units-=quantity;p.cost_cents-=cost;
  if(!p.quantity_units)delete state.positions[symbol];
 }else throw Error('Invalid transaction type.');
 state.fees_cents+=FEE;state.trade_count++;if(![state.cash_cents,state.fees_cents,state.realized_cents].every(Number.isSafeInteger))throw Error('Account value exceeds the supported range.');return {...t,gross_cents:gross,fee_cents:FEE,cash_after_cents:state.cash_cents};
}
function valuation(state,prices){
 const holdings=Object.values(state.positions).map(p=>{const quote=prices[p.symbol];if(!quote)throw Error(`Enter a price for ${p.symbol}.`);const value=amount(quote.price_units,p.quantity_units);return {...p,...quote,market_value_cents:value,unrealized_cents:value-p.cost_cents};});
 const investments=holdings.reduce((n,p)=>n+p.market_value_cents,0),unrealized=holdings.reduce((n,p)=>n+p.unrealized_cents,0),assets=state.cash_cents+investments;
 if(![investments,unrealized,assets].every(Number.isSafeInteger))throw Error('Portfolio value exceeds the supported range.');
 return {cash_cents:state.cash_cents,investments_cents:investments,assets_cents:assets,liabilities_cents:0,equity_cents:assets,capital_cents:CAPITAL,realized_cents:state.realized_cents,unrealized_cents:unrealized,profit_cents:assets-CAPITAL,fees_cents:state.fees_cents,trade_count:state.trade_count,holdings};
}
module.exports={CAPITAL,FEE,SHARE_SCALE,PRICE_SCALE,decimalUnits,ticker,source,orderInput,ledger,applyTrade,valuation};
