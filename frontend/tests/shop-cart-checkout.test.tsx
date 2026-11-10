// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {api} from '@/lib/api/client';
import {
 positiveId,stockAvailable,productPrice,productCurrency,filterCatalog,speciesOptions,cartTotals,checkoutProblem,
 shippingAddresses,newCheckoutKey,type CatalogFilter,
} from '@/lib/shop/catalog';
import {ShopCatalog} from '@/components/shop/ShopCatalog';
import {ProductPurchase} from '@/components/features/ProductPurchase';
import {CartWorkspace} from '@/components/features/CartWorkspace';
import {CheckoutForm} from '@/components/shop/CheckoutForm';

const mockPush=vi.hoisted(()=>vi.fn());
vi.mock('next/navigation',()=>({useRouter:()=>({push:mockPush})}));
vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const foodA={id:41,title:'Salmon Cat Food',brand:'Happy Paw',categoryId:3,species:'CAT',priceMinor:12550,currency:'BDT',availableQuantity:8};
const foodB={id:42,title:'Chicken Dog Treats',brand:'Pet World',categoryId:4,species:'DOG',priceMinor:8500,currency:'BDT',availableQuantity:0};
const foodC={id:43,title:'Cat Biscuits',brand:'Happy Paw',categoryId:3,species:'CAT',priceMinor:350,currency:'USD',availableQuantity:14};
const products=[foodA,foodB,foodC];
const categories=[{id:3,name:'Cat food'},{id:4,name:'Treats'}];
const cart=[{productId:41,title:'Salmon Cat Food',priceMinor:12550,currency:'BDT',quantity:2},{productId:42,title:'Chicken Dog Treats',priceMinor:8500,currency:'BDT',quantity:1}];
const shipping={id:19,recipientName:'Nadia',line1:'Road 12',city:'Dhaka',scope:'SHIPPING',status:'ACTIVE'};
const billing={id:20,recipientName:'Nadia',line1:'Office',city:'Dhaka',scope:'BILLING',status:'ACTIVE'};
const otherShipping={id:21,recipientName:'Nadia',line1:'Home 2',city:'Dhaka',scope:'SHIPPING',status:'ACTIVE'};
const filter:CatalogFilter={query:'',species:'ALL',category:'ALL',stock:'ALL',sort:'NEWEST'};
function setupCart(items=cart){mockApi.mockImplementation((async path=>path==='/cart'?items:{productId:41,quantity:2}) as typeof api);}
function setupCheckout(items=cart){mockApi.mockImplementation((async (path:string,opts?:{method?:string})=>{
 if(path==='/users/me/addresses')return [billing,shipping,otherShipping];
 if(path==='/cart')return items;
 if(path==='/checkout'&&opts?.method==='POST')return {id:99,status:'PLACED',paymentStatus:'NOT_PAID'};
 throw new Error('Unknown endpoint');
}) as typeof api);}
beforeEach(()=>{vi.resetAllMocks();});
afterEach(()=>cleanup());

describe('Oracle catalog and cart data boundaries',()=>{
 it('accepts only safe positive IDs',()=>{
  expect(positiveId('0041')).toBe('0041');expect(positiveId(41)).toBe('41');
  for(const id of [null,undefined,0,-1,1.5,'abc','1/../../admin','9007199254740993'])expect(positiveId(id)).toBe('');
 });
 it('distinguishes missing stock from zero stock',()=>{
  expect(stockAvailable(foodA)).toBe(8);expect(stockAvailable(foodB)).toBe(0);
  expect(stockAvailable({})).toBeNull();expect(stockAvailable({availableQuantity:-1})).toBeNull();
 });
 it('rejects invalid or missing price instead of presenting a fabricated zero',()=>{
  expect(productPrice(foodA)).toBe(12550);expect(productPrice({priceMinor:0})).toBe(0);
  expect(productPrice({})).toBeNull();expect(productPrice({priceMinor:-5})).toBeNull();
 });
 it('accepts backend currency codes and uses a predictable fallback',()=>{
  expect(productCurrency(foodC)).toBe('USD');expect(productCurrency({currency:'bdt'})).toBe('BDT');
  expect(productCurrency({currency:'INJECTED'})).toBe('BDT');
 });
 it('only searches public product fields, not arbitrary JSON',()=>{
  const withSecret={...foodA,privateOwnerEmail:'private@example.com'};
  expect(filterCatalog([withSecret],{...filter,query:'private'})).toEqual([]);
  expect(filterCatalog([withSecret],{...filter,query:'SALMON'})).toEqual([withSecret]);
 });
 it('filters species using exact matching and ignores unavailable stock',()=>{
  expect(filterCatalog(products,{...filter,species:'CAT'})).toEqual([foodA,foodC]);
  expect(filterCatalog(products,{...filter,stock:'AVAILABLE'})).toEqual([foodA,foodC]);
 });
 it('filters by the matching backend category id',()=>{
  expect(filterCatalog(products,{...filter,category:'4'})).toEqual([foodB]);
  expect(filterCatalog(products,{...filter,category:'999'})).toEqual([]);
 });
 it('sorts by name and price without changing the backend response order',()=>{
  expect(filterCatalog(products,{...filter,sort:'NAME'}).map(x=>x.id)).toEqual([43,42,41]);
  expect(filterCatalog(products,{...filter,sort:'PRICE_ASC'}).map(x=>x.id)).toEqual([43,42,41]);
  expect(filterCatalog(products,{...filter,sort:'PRICE_DESC'}).map(x=>x.id)).toEqual([41,42,43]);
  expect(products.map(p=>p.id)).toEqual([41,42,43]);
 });
 it('safely derives distinct filter species',()=>{
  expect(speciesOptions(products)).toEqual(['CAT','DOG']);
 });
 it('sums integer minor units separately for each currency',()=>{
  expect(cartTotals([...cart,{productId:43,quantity:3,priceMinor:350,currency:'USD'}])).toEqual([
   {currency:'BDT',totalMinor:33600,quantity:3},{currency:'USD',totalMinor:1050,quantity:3},
  ]);
 });
 it('does not aggregate corrupt cart rows into totals',()=>{
  expect(cartTotals([...cart,{productId:43,quantity:-1,priceMinor:350,currency:'USD'}])).toEqual([{currency:'BDT',totalMinor:33600,quantity:3}]);
 });
 it('blocks empty, invalid and mixed-currency checkout before sending',()=>{
  expect(checkoutProblem([])).toMatch(/empty/i);
  expect(checkoutProblem([...cart,{productId:43,quantity:1,priceMinor:350,currency:'USD'}])).toMatch(/different currencies/i);
  expect(checkoutProblem([{...cart[0],quantity:0}])).toMatch(/invalid/i);
  expect(checkoutProblem(cart)).toBeNull();
 });
 it('only accepts saved active shipping addresses with safe IDs',()=>{
  const list=[billing,shipping,{...otherShipping,status:'DELETED'},{...shipping,id:'../../x'}];
  expect(shippingAddresses(list)).toEqual([shipping]);
 });
 it('creates backend-compatible unique idempotency keys',()=>{
  const a=newCheckoutKey(),b=newCheckoutKey();
  expect(a).toMatch(/^[0-9a-f]{32}$/);expect(b).not.toBe(a);
 });
 it('fixes the catalog route rather than rendering a duplicate product-detail page',()=>{
  const page=readFileSync(join(process.cwd(),'app/(public)/shop/page.tsx'),'utf8');
  expect(page).toContain("safePublic('/shop/products')");
  expect(page).toContain("safePublic('/shop/categories')");
  expect(page).toContain('<ShopCatalog');
 });
});

describe('Public food store and product purchasing',()=>{
 it('shows the active catalog and navigable product details',()=>{
  render(<ShopCatalog products={products} categories={categories} productError={null} categoryError={null}/>);
  expect(screen.getByText('Salmon Cat Food')).toBeInTheDocument();
  expect(screen.getByText('Out of stock')).toBeInTheDocument();
  expect(screen.getAllByRole('link',{name:/view details/i})).toHaveLength(3);
 });
 it('filters products without sending another API request',()=>{
  render(<ShopCatalog products={products} categories={categories} productError={null} categoryError={null}/>);
  fireEvent.change(screen.getByRole('searchbox',{name:'Search products'}),{target:{value:'salmon'}});
  expect(screen.getByText('Salmon Cat Food')).toBeInTheDocument();
  expect(screen.queryByText('Chicken Dog Treats')).not.toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('supports category and availability filtering',()=>{
  render(<ShopCatalog products={products} categories={categories} productError={null} categoryError={null}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Filter products by category'}),{target:{value:'4'}});
  expect(screen.getByText('Chicken Dog Treats')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox',{name:'Filter products by availability'}),{target:{value:'AVAILABLE'}});
  expect(screen.getByText('No matching products')).toBeInTheDocument();
 });
 it('reports API failure without claiming the store is empty',()=>{
  render(<ShopCatalog products={[]} categories={[]} productError="Catalog unavailable" categoryError={null}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('Catalog unavailable');
  expect(screen.queryByText('No products available')).not.toBeInTheDocument();
 });
 it('retains products when category lookups fail',()=>{
  render(<ShopCatalog products={products} categories={[]} productError={null} categoryError="Categories unavailable"/>);
  expect(screen.getByText('Salmon Cat Food')).toBeInTheDocument();
  expect(screen.getByText(/categories are unavailable/i)).toBeInTheDocument();
 });
 it('POSTs only the exact supported cart-item payload via PUT',async()=>{
  mockApi.mockResolvedValue({productId:41,quantity:2});
  render(<ProductPurchase id="41" availableQuantity={8}/>);
  fireEvent.change(screen.getByRole('spinbutton',{name:'Quantity'}),{target:{value:'2'}});
  fireEvent.click(screen.getByRole('button',{name:'Add to cart'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/cart/items',{method:'PUT',body:{productId:41,quantity:2}}));
  expect(await screen.findByText(/cart updated successfully/i)).toBeInTheDocument();
 });
 it('blocks quantity above reported stock and an unsafe product id',async()=>{
  render(<ProductPurchase id="../../bad" availableQuantity={8}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add to cart'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a quantity');
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('blocks sold-out items without sending a request',()=>{
  render(<ProductPurchase id="42" availableQuantity={0}/>);
  expect(screen.getByRole('button',{name:'Add to cart'})).toBeDisabled();
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('does not falsely claim cart success after API failure',async()=>{
  mockApi.mockRejectedValue(new Error('Sign in required'));
  render(<ProductPurchase id="41" availableQuantity={8}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add to cart'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sign in required');
  expect(screen.queryByText(/cart updated successfully/i)).not.toBeInTheDocument();
 });
});

describe('Owner cart and unpaid checkout',()=>{
 it('loads a private cart and shows its BDT subtotal',async()=>{
  setupCart();render(<CartWorkspace/>);
  expect(await screen.findByText('Salmon Cat Food')).toBeInTheDocument();
  expect(screen.getByText(/BDT estimated subtotal/i)).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Proceed to checkout'})).toBeInTheDocument();
 });
 it('increments and removes products with the exact Oracle API contract',async()=>{
  setupCart();render(<CartWorkspace/>);await screen.findByText('Salmon Cat Food');
  fireEvent.click(screen.getByRole('button',{name:'Increase Salmon Cat Food quantity'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/cart/items',{method:'PUT',body:{productId:41,quantity:3}}));
 });
 it('sends zero when removing an item',async()=>{
  setupCart();render(<CartWorkspace/>);await screen.findByText('Salmon Cat Food');
  fireEvent.click(screen.getAllByRole('button',{name:'Remove'})[0]);
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/cart/items',{method:'PUT',body:{productId:41,quantity:0}}));
 });
 it('does not allow mixed-currency cart checkout',async()=>{
  setupCart([...cart,{productId:43,title:'Cat Biscuits',priceMinor:350,currency:'USD',quantity:1}]);
  render(<CartWorkspace/>);await screen.findByText('Cat Biscuits');
  expect(screen.queryByRole('link',{name:'Proceed to checkout'})).not.toBeInTheDocument();
  expect(screen.getByText(/different currencies cannot be placed/i)).toBeInTheDocument();
 });
 it('shows retryable API failures instead of an empty-cart prompt',async()=>{
  mockApi.mockRejectedValue(new Error('Cart service unavailable'));
  render(<CartWorkspace/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Cart service unavailable');
  expect(screen.queryByText('Your cart is empty')).not.toBeInTheDocument();
 });
 it('loads only shipping addresses automatically',async()=>{
  setupCheckout();render(<CheckoutForm/>);
  const select=await screen.findByRole('combobox',{name:'Delivery address'});
  expect(select).toHaveValue('19');
  expect(screen.getAllByRole('option')).toHaveLength(2);
  expect(screen.queryByRole('option',{name:/office/i})).not.toBeInTheDocument();
 });
 it('places an unpaid order with a stable, valid idempotency key',async()=>{
  setupCheckout();render(<CheckoutForm/>);await screen.findByRole('combobox',{name:'Delivery address'});
  fireEvent.click(screen.getByRole('button',{name:'Reserve stock & place unpaid order'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/checkout',{
   method:'POST',body:{shippingAddressId:19},idempotencyKey:expect.stringMatching(/^[a-f0-9]{32}$/),
  }));
  await waitFor(()=>expect(mockPush).toHaveBeenCalledWith('/orders/99'));
 });
 it('preserves an idempotency key when retrying a failed checkout request',async()=>{
  let submits=0;
  mockApi.mockImplementation((async (path:string,opts?:{method?:string})=>{
   if(path==='/users/me/addresses')return [shipping];
   if(path==='/cart')return cart;
   if(path==='/checkout'&&opts?.method==='POST'){
    submits++;if(submits===1)throw new Error('Connection interrupted');return {id:99};
   }
   throw new Error('Unknown API');
  }) as typeof api);
  render(<CheckoutForm/>);await screen.findByRole('combobox',{name:'Delivery address'});
  fireEvent.click(screen.getByRole('button',{name:'Reserve stock & place unpaid order'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
  fireEvent.click(screen.getByRole('button',{name:'Reserve stock & place unpaid order'}));
  await waitFor(()=>expect(mockPush).toHaveBeenCalledWith('/orders/99'));
  const calls=mockApi.mock.calls.filter(([path])=>path==='/checkout');
  expect(calls).toHaveLength(2);expect(calls[0][1]?.idempotencyKey).toBe(calls[1][1]?.idempotencyKey);
 });
 it('refuses checkout for mixed currencies before a POST',async()=>{
  setupCheckout([...cart,{productId:43,title:'Cat Biscuits',priceMinor:350,currency:'USD',quantity:1}]);
  render(<CheckoutForm/>);await screen.findByRole('combobox',{name:'Delivery address'});
  expect(screen.getByRole('button',{name:'Reserve stock & place unpaid order'})).toBeDisabled();
  expect(mockApi.mock.calls.filter(([path])=>path==='/checkout')).toHaveLength(0);
 });
 it('refuses checkout when only billing addresses exist',async()=>{
  mockApi.mockImplementation((async path=>path==='/cart'?cart:[billing]) as typeof api);
  render(<CheckoutForm/>);
  expect(await screen.findByText(/need a saved shipping address/i)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Reserve stock & place unpaid order'})).toBeDisabled();
 });
 it('reports checkout loading failure without showing a false success',async()=>{
  mockApi.mockRejectedValue(new Error('Address service unavailable'));
  render(<CheckoutForm/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Address service unavailable');
  expect(mockPush).not.toHaveBeenCalled();
 });
});
