import type {Row} from '@/lib/types/domain';
import {formatMoney} from '@/lib/utils/currency';
import {cartTotals} from '@/lib/shop/catalog';

export function CartSummary({items}:{items:Row[]}){
 const totals=cartTotals(items);
 return <div className="summary-card"><h3>Cart summary</h3>
  <div className="summary-row"><span>Items</span><strong>{totals.reduce((n,t)=>n+t.quantity,0)}</strong></div>
  {totals.map(t=><div className="summary-row" key={t.currency}><span>{t.currency} estimated subtotal</span><strong>{formatMoney(t.totalMinor,t.currency)}</strong></div>)}
  {totals.length>1&&<p className="form-alert" role="status">Multiple currencies cannot be combined into one order.</p>}
  <div className="divider"/><p className="hint">Final stock, pricing, and shipping are checked by the server. Checkout creates an unpaid order; payment is not enabled.</p>
 </div>;
}
