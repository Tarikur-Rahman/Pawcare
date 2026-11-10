import {safePublic} from '@/lib/api/server';
import {rows} from '@/lib/types/domain';
import {ShopCatalog} from '@/components/shop/ShopCatalog';

export const dynamic='force-dynamic';

export default async function Page(){
 const [products,categories]=await Promise.all([safePublic('/shop/products'),safePublic('/shop/categories')]);
 return <ShopCatalog products={rows(products.data)} categories={rows(categories.data)}
  productError={products.error} categoryError={categories.error}/>;
}
