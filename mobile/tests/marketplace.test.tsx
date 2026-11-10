import React from 'react';import {render,fireEvent} from '@testing-library/react-native';
import {SaleCard} from '../src/components/marketplace/SaleCard';import {formatMoney} from '../src/lib/utils/money';
describe('marketplace',()=>{
 it('renders listing with server minor-unit price and no purchase button',async()=>{
 const screen=await render(<SaleCard item={{id:9,title:'Verified listing',species:'DOG',description:'Health checked',generalArea:'Dhaka',askingMinor:120000,currency:'BDT'}} onPress={jest.fn()}/>);
 expect(screen.getByText('Verified listing')).toBeTruthy();expect(screen.queryByText('Buy now')).toBeNull();
 });
 it('formats integer minor units',()=>expect(formatMoney(1250,'USD')).toContain('12.50'));
});
