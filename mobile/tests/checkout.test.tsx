import React from 'react';import {render,fireEvent} from '@testing-library/react-native';
import {CheckoutForm} from '../src/components/shop/CheckoutForm';import {toMinorUnits} from '../src/lib/utils/money';
describe('checkout safety',()=>{
 it('converts decimal input to integer minor units',()=>{expect(toMinorUnits('14.05')).toBe(1405);expect(()=>toMinorUnits('4.999')).toThrow();});
 it('requires a positive shipping address ID before submitting',async()=>{
 const submit=jest.fn();const screen=await render(<CheckoutForm addresses={[{id:11,recipientName:'Test owner',line1:'Street',city:'Dhaka',countryCode:'BD',scope:'SHIPPING'}]} onCheckout={submit} onAddAddress={jest.fn()}/>);
 await fireEvent.press(screen.getByText('Place unpaid order'));expect(submit).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByText('Test owner · Dhaka (#11)'));
 await fireEvent.press(screen.getByText('Place unpaid order'));expect(submit).toHaveBeenCalledWith(11);
 });
});
