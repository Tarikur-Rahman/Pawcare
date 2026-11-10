import React from 'react';import {render,fireEvent} from '@testing-library/react-native';
import {AdoptionCard} from '../src/components/adoption/AdoptionCard';
describe('AdoptionCard',()=>{
 it('shows moderated public listing data and opens details',async()=>{
 const click=jest.fn();const screen=await render(<AdoptionCard item={{id:10,title:'Buddy needs a home',species:'DOG',description:'Good with children',generalArea:'Dhaka'}} onPress={click}/>);
 expect(screen.getByText('Buddy needs a home')).toBeTruthy();await fireEvent.press(screen.getByText('Buddy needs a home'));expect(click).toHaveBeenCalledTimes(1);
 });
});
