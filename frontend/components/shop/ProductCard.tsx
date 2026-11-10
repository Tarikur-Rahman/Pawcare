import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {str,type Row} from '@/lib/types/domain';
import {formatMoney} from '@/lib/utils/currency';
import {productId,productPrice,productCurrency,stockAvailable} from '@/lib/shop/catalog';

export function ProductCard({item}:{item:Row}){
 const id=productId(item),price=productPrice(item),stock=stockAvailable(item);
 return <article className="listing-card shop-product-card"><div className="listing-visual listing-food"><span aria-hidden="true">🥣</span><div className="visual-tag">Pet nutrition</div></div>
  <div className="listing-content"><span className="eyebrow">{str(item,'brand')||'FOOD & TREATS'}</span><h3>{str(item,'title')||'Unnamed product'}</h3>
   <p>{str(item,'species')||'For your companion'}</p>
   <p className={stock===0?'shop-stockout':'shop-stock'}>{stock===0?'Out of stock':stock===null?'Availability at checkout':`${stock} available`}</p>
   <div className="listing-bottom"><strong>{price===null?'Price unavailable':formatMoney(price,productCurrency(item))}</strong>
    {id?<Link href={`/shop/${id}`} className="inline-link">View details <ArrowUpRight size={17} aria-hidden="true"/></Link>:null}</div>
  </div>
 </article>;
}
