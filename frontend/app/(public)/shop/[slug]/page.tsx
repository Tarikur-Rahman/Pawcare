import Link from 'next/link';
import {notFound} from 'next/navigation';
import {safePublic} from '@/lib/api/server';
import {str,num,type Row} from '@/lib/types/domain';
import {formatMoney} from '@/lib/utils/currency';
import {productCurrency,productPrice,positiveId,stockAvailable} from '@/lib/shop/catalog';
import {FavoriteButton} from '@/components/features/FavoriteButton';
import {ReportListing} from '@/components/features/ReportListing';
import {ProductPurchase} from '@/components/features/ProductPurchase';

export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const id=positiveId(slug);if(!id)notFound();
 const {data,error}=await safePublic('/shop/products/'+id);
 if(!data&&!error)notFound();
 const item=(data||{}) as Row,price=productPrice(item),stock=stockAvailable(item);
 return <div className="container detail-page">
  <div className="breadcrumbs"><Link href="/">Home</Link> / <Link href="/shop">Food & treats</Link> / Details</div>
  <div className="detail-grid"><div className="detail-main">
   <div className="detail-art"><span aria-hidden="true">🥣</span></div>
   <span className="eyebrow">{str(item,'brand')||'PET FOOD'}</span><h1 className="detail-title">{str(item,'title')||'Product details'}</h1>
   {error?<p role="alert" className="form-alert">{error}</p>:<>
    <p className="detail-body">{str(item,'description')||'No product description has been supplied.'}</p>
    <div className="panel shop-product-specs"><h2>Product information</h2>
     <dl><div><dt>Suitable for</dt><dd>{str(item,'species')||'Not specified'}</dd></div>
      <div><dt>Net weight</dt><dd>{num(item,'weightGrams')>0?`${num(item,'weightGrams')} g`:'Not specified'}</dd></div>
      <div><dt>Price</dt><dd>{price===null?'Unavailable':formatMoney(price,productCurrency(item))}</dd></div>
      <div><dt>Stock</dt><dd>{stock===null?'Confirm at checkout':stock===0?'Out of stock':`${stock} available`}</dd></div>
      <div><dt>Ingredients</dt><dd>{str(item,'ingredients')||'Not supplied'}</dd></div>
      <div><dt>Allergens</dt><dd>{str(item,'allergens')||'Not supplied'}</dd></div></dl></div>
    <div className="shop-product-moderation"><FavoriteButton entityType="FOOD_PRODUCT" entityId={id}/><ReportListing entityType="FOOD_PRODUCT" entityId={id}/></div>
   </>}
  </div><aside className="detail-side"><div className="panel"><h2>Add to cart</h2><p className="hint">Stock and pricing are confirmed by the Oracle-backed server when you place the order.</p>
   {error?<Link href="/shop" className="btn btn-secondary">Back to store</Link>
    :<ProductPurchase id={id} availableQuantity={stock} disabled={price===null}/>}<p className="disclaimer">You must be <Link href="/login">signed in</Link> to add products to your cart. Checkout creates an unpaid order; no payment is charged.</p>
  </div></aside></div></div>;
}
