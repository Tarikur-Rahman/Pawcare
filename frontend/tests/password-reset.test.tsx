// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ForgotPasswordForm,ResetPasswordForm} from '@/components/features/AuthForms';
import {authAction} from '@/lib/api/client';

vi.mock('@/lib/api/client',()=>({authAction:vi.fn()}));
const mockedAuth=vi.mocked(authAction);
const fill=(name:string,value:string)=>fireEvent.change(screen.getByLabelText(new RegExp(`^${name}\\s*\\*?$`,'i')),{target:{value}});
const token='A'.repeat(64);

beforeEach(()=>{
 vi.clearAllMocks();
 window.history.replaceState({},'', '/forgot-password');
});

describe('forgot password',()=>{
 it('submits normalized email without disclosing account existence',async()=>{
   mockedAuth.mockResolvedValue({message:'Accepted'});
   render(<ForgotPasswordForm/>);
   fill('Email address','Owner@Example.com');
   fireEvent.submit(screen.getByRole('button',{name:'Send reset link'}).closest('form')!);
   expect(await screen.findByRole('status')).toHaveTextContent('If an eligible account exists');
   expect(mockedAuth).toHaveBeenCalledWith('forgot-password',{email:'owner@example.com'});
 });
 it('rejects invalid email without an API request',()=>{
   render(<ForgotPasswordForm/>);
   fill('Email address','not-an-email');
   fireEvent.submit(screen.getByRole('button',{name:'Send reset link'}).closest('form')!);
   expect(mockedAuth).not.toHaveBeenCalled();
 });
});

describe('reset password',()=>{
 it('reads and clears fragment then changes password only once',async()=>{
   window.history.replaceState({},'','/reset-password#token='+token);
   mockedAuth.mockResolvedValue({message:'Password changed'});
   render(<ResetPasswordForm/>);
   expect(await screen.findByRole('button',{name:'Set new password'})).toBeInTheDocument();
   expect(window.location.hash).toBe('');
   fill('New password','valid-new-password-123');
   fill('Confirm new password','valid-new-password-123');
   fireEvent.submit(screen.getByRole('button',{name:'Set new password'}).closest('form')!);
   expect(await screen.findByRole('status')).toHaveTextContent('password was updated');
   expect(mockedAuth).toHaveBeenCalledTimes(1);
   expect(mockedAuth).toHaveBeenCalledWith('reset-password',{token,newPassword:'valid-new-password-123'});
 });
 it('never requests reset with an absent or malformed token',async()=>{
   window.history.replaceState({},'','/reset-password#token=short');
   render(<ResetPasswordForm/>);
   expect(await screen.findByRole('alert')).toHaveTextContent('missing or invalid');
   expect(mockedAuth).not.toHaveBeenCalled();
 });
 it('rejects mismatched passwords before hitting API',async()=>{
   window.history.replaceState({},'','/reset-password#token='+token);
   render(<ResetPasswordForm/>);
   await screen.findByRole('button',{name:'Set new password'});
   fill('New password','valid-new-password-123');
   fill('Confirm new password','other-new-password-456');
   fireEvent.submit(screen.getByRole('button',{name:'Set new password'}).closest('form')!);
   await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match'));
   expect(mockedAuth).not.toHaveBeenCalled();
 });
});
