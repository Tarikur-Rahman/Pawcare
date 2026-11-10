// @vitest-environment jsdom
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {api} from '@/lib/api/client';
import {OrdersWorkspace} from '@/components/features/OrdersWorkspace';
import {OrderDetailWorkspace} from '@/components/features/OrderDetailWorkspace';
import {OrderActions} from '@/components/features/OrderActions';
import {
 orderId,orderStatus,orderNumber,orderTotalMinor,orderCurrency,orderTimestamp,orderDate,orderIsCancelable,
 filterOrders,newestOrders,orderSummary,orderMatchesFilter,shipmentId,shipmentTracking,
} from '@/lib/orders/records';
import type {Row} from '@/lib/types/domain';

vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const orders:Row[]=[
 {id:51,orderNumber:'PC-001',status:'PLACED',totalMinor:15000,currency:'BDT',createdAt:'2026-11-05T10:00:00Z'},
 {id:52,orderNumber:'PC-002',status:'SHIPPED',totalMinor:3600,currency:'USD',createdAt:'2026-11-07T10:00:00Z'},
 {id:53,orderNumber:'PC-003',status:'DELIVERED',totalMinor:4900,currency:'BDT',createdAt:'2026-11-06T10:00:00Z'},
 {id:54,orderNumber:'PC-004',status:'CANCELLED',totalMinor:2500,currency:'BDT',createdAt:'2026-11-04T10:00:00Z'},
];
function defaultApi(){
 mockApi.mockImplementation((async(path:string)=>{
  if(path==='/orders')return orders;
  if(path==='/orders/52/shipments/')return [{id:90,carrier:'Express Courier',trackingRef:'TRACK-123',status:'SHIPPED',shippedAt:'2026-11-07T12:00:00Z'}];
  return undefined;
 }) as typeof api);
}
beforeEach(()=>{vi.resetAllMocks();defaultApi();window.history.replaceState({},'','/orders');});
afterEach(()=>cleanup());

describe('Orders API normalization and visibility',()=>{
 it('accepts only safe positive order IDs',()=>{
  expect(orderId(orders[0])).toBe('51');
  for(const id of ['../52','0','-1','3.2','9007199254740993',null,undefined])expect(orderId({id})).toBe('');
 });
 it('normalizes known statuses but does not invent unknown ones',()=>{
  expect(orderStatus({STATUS:' shipped '})).toBe('SHIPPED');
  expect(orderStatus({status:'CUSTOM'})).toBe('UNKNOWN');
  expect(orderStatus({})).toBe('UNKNOWN');
 });
 it('uses orderNumber with safe readable fallback',()=>{
  expect(orderNumber(orders[0])).toBe('PC-001');
  expect(orderNumber({id:99})).toBe('Order #99');
  expect(orderNumber({id:'../bad'})).toBe('Order number unavailable');
 });
 it('uses valid amounts without turning missing totals into zero',()=>{
  expect(orderTotalMinor({totalMinor:'0'})).toBe(0);
  expect(orderTotalMinor({totalMinor:123})).toBe(123);
  for(const v of [null,undefined,'',-1,'2.3',true,'9007199254740993','invalid'])expect(orderTotalMinor({totalMinor:v})).toBeNull();
 });
 it('treats invalid currencies as unavailable',()=>{
  expect(orderCurrency({currency:' bdt '})).toBe('BDT');
  expect(orderCurrency({currency:'INVALID'})).toBeNull();
  expect(orderCurrency({})).toBeNull();
 });
 it('validates timestamps and never displays an invented date',()=>{
  expect(orderTimestamp({createdAt:'2026-11-07T10:00:00Z'})).toBeGreaterThan(0);
  expect(orderDate({createdAt:'not-a-date'})).toBe('Date unavailable');
  expect(orderTimestamp({createdAt:0})).toBeNull();
 });
 it('only enables cancellation for identifiable PLACED orders',()=>{
  expect(orderIsCancelable(orders[0])).toBe(true);
  expect(orderIsCancelable(orders[1])).toBe(false);
  expect(orderIsCancelable({status:'PLACED',id:'../../bad'})).toBe(false);
 });
 it('classifies the approved Oracle order statuses',()=>{
  expect(orderMatchesFilter({status:'PAID'},'IN_PROGRESS')).toBe(true);
  expect(orderMatchesFilter({status:'PACKED'},'IN_PROGRESS')).toBe(true);
  expect(orderMatchesFilter({status:'SHIPPED'},'IN_PROGRESS')).toBe(true);
  expect(orderMatchesFilter({status:'REFUNDED'},'CLOSED')).toBe(true);
  expect(orderMatchesFilter({status:'CANCELLED'},'CLOSED')).toBe(true);
  expect(orderMatchesFilter({status:'DELIVERED'},'DELIVERED')).toBe(true);
  expect(orderMatchesFilter({status:'CUSTOM'},'CLOSED')).toBe(false);
 });
 it('searches order IDs, numbers and statuses without mutating inputs',()=>{
  expect(filterOrders(orders,'ALL','pc-002')).toEqual([orders[1]]);
  expect(filterOrders(orders,'ALL','51')).toEqual([orders[0]]);
  expect(filterOrders(orders,'ALL','SHIPPED')).toEqual([orders[1]]);
  expect(filterOrders(orders,'PLACED','pc-003')).toEqual([]);
  expect(orders).toHaveLength(4);
 });
 it('sorts recent orders newest-first without mutating the original array',()=>{
  expect(newestOrders(orders).map(orderId)).toEqual(['52','53','51','54']);
  expect(orders[0].id).toBe(51);
  expect(newestOrders([{id:9,createdAt:'bad'},{id:2,createdAt:'2026-11-07T00:00:00Z'}]).map(orderId)).toEqual(['2','9']);
 });
 it('summarizes only supplied records, not estimated lifetime counts',()=>{
  expect(orderSummary(orders)).toEqual({recent:4,placed:1,inProgress:1,delivered:1});
 });
 it('safely displays shipment metadata and handles missing tracking',()=>{
  expect(shipmentId({id:'90'})).toBe('90');
  expect(shipmentId({id:'../../wrong'})).toBe('');
  expect(shipmentTracking({trackingRef:' TK-900 '})).toBe('TK-900');
  expect(shipmentTracking({})).toBe('Not provided');
 });
});

describe('Owner order history',()=>{
 it('loads authenticated orders and links to their own detail routes',async()=>{
  render(<OrdersWorkspace/>);
  expect(await screen.findByText('PC-001')).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledWith('/orders',{signal:expect.any(AbortSignal)});
  expect(screen.getAllByRole('link',{name:'View order'})).toHaveLength(4);
  expect(screen.getAllByRole('link',{name:'View order'})[0]).toHaveAttribute('href','/orders/52');
 });
 it('shows correct status summary and does not add mixed-currency totals',async()=>{
  render(<OrdersWorkspace/>);await screen.findByText('PC-001');
  expect(screen.getByLabelText('Recent order summary')).toHaveTextContent('Recent orders (max 100)');
  expect(screen.getByText('$36.00')).toBeInTheDocument();
 });
 it('supports search without fetching again',async()=>{
  render(<OrdersWorkspace/>);await screen.findByText('PC-001');
  fireEvent.change(screen.getByRole('searchbox',{name:'Search orders'}),{target:{value:'PC-003'}});
  expect(screen.getByText('PC-003')).toBeInTheDocument();
  expect(screen.queryByText('PC-001')).not.toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledTimes(1);
 });
 it('filters in-progress orders by backend state',async()=>{
  render(<OrdersWorkspace/>);await screen.findByText('PC-001');
  fireEvent.click(screen.getByRole('button',{name:'In progress'}));
  expect(screen.getByText('PC-002')).toBeInTheDocument();
  expect(screen.queryByText('PC-001')).not.toBeInTheDocument();
 });
 it('shows a distinct no-matching-results state',async()=>{
  render(<OrdersWorkspace/>);await screen.findByText('PC-001');
  fireEvent.change(screen.getByRole('searchbox',{name:'Search orders'}),{target:{value:'UNMATCHED-ORDER'}});
  expect(screen.getByText('No matching orders')).toBeInTheDocument();
 });
 it('shows a truthful empty state if backend has no orders',async()=>{
  mockApi.mockResolvedValueOnce([]);render(<OrdersWorkspace/>);
  expect(await screen.findByText('No orders yet')).toBeInTheDocument();
  expect(screen.getAllByRole('link',{name:'Browse food'}).length).toBeGreaterThan(0);
 });
 it('shows retryable errors, never a false empty-history message',async()=>{
  mockApi.mockRejectedValueOnce(new Error('Order service unavailable'));
  render(<OrdersWorkspace/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Order service unavailable');
  expect(screen.queryByText('No orders yet')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  expect(await screen.findByText('PC-001')).toBeInTheDocument();
 });
 it('does not expose an order link for an unsafe identifier',async()=>{
  mockApi.mockResolvedValueOnce([{id:'../bad',orderNumber:'Invalid id',status:'PLACED'}]);
  render(<OrdersWorkspace/>);
  expect(await screen.findByText('Invalid id')).toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'View order'})).not.toBeInTheDocument();
  expect(screen.getByText('Details unavailable')).toBeInTheDocument();
 });
});

describe('Order details and cancellation',()=>{
 it('displays only order-summary fields with no fabricated item lines',()=>{
  render(<OrderDetailWorkspace initialOrder={orders[0]}/>);
  expect(screen.getByRole('heading',{name:'PC-001'})).toBeInTheDocument();
  expect(screen.getByText('Order summary')).toBeInTheDocument();
  expect(screen.getByText(/does not return product-line details/i)).toBeInTheDocument();
  expect(screen.queryByText('Shipment tracking')).not.toBeInTheDocument();
 });
 it('requires explicit confirmation before cancelling',()=>{
  render(<OrderActions id="51" status="PLACED"/>);
  expect(screen.queryByRole('button',{name:'Confirm cancellation'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Cancel unpaid order'}));
  expect(screen.getByRole('button',{name:'Confirm cancellation'})).toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Keep order'}));
  expect(screen.queryByRole('button',{name:'Confirm cancellation'})).not.toBeInTheDocument();
 });
 it('POSTs cancel without a fabricated payload and updates status after 204',async()=>{
  mockApi.mockResolvedValue(undefined);
  render(<OrderDetailWorkspace initialOrder={orders[0]}/>);
  fireEvent.click(screen.getByRole('button',{name:'Cancel unpaid order'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm cancellation'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/orders/51/cancel',{method:'POST'}));
  expect(await screen.findByText('This order has been cancelled.')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Cancel unpaid order'})).not.toBeInTheDocument();
 });
 it('does not fake cancellation when the API rejects a request',async()=>{
  mockApi.mockRejectedValue(new Error('Payment processing is in progress'));
  render(<OrderDetailWorkspace initialOrder={orders[0]}/>);
  fireEvent.click(screen.getByRole('button',{name:'Cancel unpaid order'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm cancellation'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Payment processing is in progress');
  expect(screen.getByRole('button',{name:'Confirm cancellation'})).toBeInTheDocument();
  expect(screen.queryByText('This order has been cancelled.')).not.toBeInTheDocument();
 });
 it('hides cancellation controls for paid, shipped or cancelled orders',()=>{
  const {rerender}=render(<OrderActions id="51" status="PAID"/>);
  expect(screen.queryByRole('button',{name:'Cancel unpaid order'})).not.toBeInTheDocument();
  rerender(<OrderActions id="51" status="SHIPPED"/>);
  expect(screen.queryByRole('button',{name:'Cancel unpaid order'})).not.toBeInTheDocument();
  rerender(<OrderActions id="51" status="CANCELLED"/>);
  expect(screen.queryByRole('button',{name:'Cancel unpaid order'})).not.toBeInTheDocument();
 });
 it('rejects a malformed ID even if status says PLACED',()=>{
  render(<OrderActions id="../evil" status="PLACED"/>);
  expect(screen.queryByRole('button',{name:'Cancel unpaid order'})).not.toBeInTheDocument();
 });
 it('loads the authenticated shipment endpoint only for shipped orders',async()=>{
  render(<OrderDetailWorkspace initialOrder={orders[1]}/>);
  expect(await screen.findByText('Express Courier')).toBeInTheDocument();
  expect(screen.getByText('Tracking: TRACK-123')).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledWith('/orders/52/shipments/',{signal:expect.any(AbortSignal)});
  expect(mockApi).not.toHaveBeenCalledWith('/orders/52/cancel',expect.anything());
 });
 it('shows a truthful no-shipment result for delivered orders',async()=>{
  mockApi.mockResolvedValueOnce([]);
  render(<OrderDetailWorkspace initialOrder={orders[2]}/>);
  expect(await screen.findByText('No shipment records returned for this order.')).toBeInTheDocument();
 });
 it('shows shipment API errors rather than claiming no shipments',async()=>{
  mockApi.mockRejectedValueOnce(new Error('Shipment service unavailable'));
  render(<OrderDetailWorkspace initialOrder={orders[1]}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Shipment service unavailable');
  expect(screen.queryByText('No shipment records returned for this order.')).not.toBeInTheDocument();
 });
 it('does not request shipments for merely PLACED orders',()=>{
  render(<OrderDetailWorkspace initialOrder={orders[0]}/>);
  expect(mockApi).not.toHaveBeenCalled();
  expect(screen.queryByText('Shipment tracking')).not.toBeInTheDocument();
 });
});
