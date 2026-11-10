// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {AuthForm,ResendVerificationForm} from '@/components/features/AuthForms';
import {authAction} from '@/lib/api/client';
import {postLoginDestination} from '@/lib/auth/destinations';

const replace=vi.fn();
const refresh=vi.fn();
vi.mock('next/navigation',()=>({useRouter:()=>({replace,refresh})}));
vi.mock('@/lib/api/client',()=>({authAction:vi.fn()}));

const mockAuth=vi.mocked(authAction);
const fill=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(new RegExp(`^${label}\\s*\\*?$`,'i')),{target:{value}});

beforeEach(()=>{vi.clearAllMocks();});

describe('post-login navigation',()=>{
 it('routes each role to its own workspace',()=>{
   expect(postLoginDestination('OWNER')).toBe('/dashboard');
   expect(postLoginDestination('VET')).toBe('/vet');
   expect(postLoginDestination('ADMIN')).toBe('/admin');
 });
 it('honors only role-appropriate internal paths',()=>{
   expect(postLoginDestination('OWNER','/pets/123?tab=health')).toBe('/pets/123?tab=health');
   expect(postLoginDestination('ADMIN','/admin/users')).toBe('/admin/users');
   expect(postLoginDestination('VET','/vet/appointments')).toBe('/vet/appointments');
   expect(postLoginDestination('OWNER','/admin')).toBe('/dashboard');
   expect(postLoginDestination('VET','/pets')).toBe('/vet');
 });
 it.each(['https://evil.example','//evil.example','/\\evil.example','/%2f%2fevil','/pets/../admin','/pets#unsafe','/unknown'])('rejects unsafe or unauthorized next=%s',value=>{
   expect(postLoginDestination('OWNER',value)).toBe('/dashboard');
 });
});

describe('authentication forms',()=>{
 it('signs in then resolves the role before navigating',async()=>{
   mockAuth.mockResolvedValueOnce({authenticated:true}).mockResolvedValueOnce({id:8,role:'VET',status:'ACTIVE',displayName:'Dr Rafi'});
   render(<AuthForm mode="login" nextPath="/vet/appointments"/>);
   fill('Email address','vet@example.com');
   fill('Password','correctPassword123');
   fireEvent.submit(screen.getByRole('button',{name:'Sign in'}).closest('form')!);
   await waitFor(()=>expect(replace).toHaveBeenCalledWith('/vet/appointments'));
   expect(mockAuth).toHaveBeenNthCalledWith(1,'login',{email:'vet@example.com',password:'correctPassword123',deviceLabel:'PawCare Web'});
   expect(mockAuth).toHaveBeenNthCalledWith(2,'me');
 });
 it('rejects passwords that violate backend length limits',async()=>{
   render(<AuthForm mode="login"/>);
   fill('Email address','owner@example.com');
   fill('Password','short');
   fireEvent.submit(screen.getByRole('button',{name:'Sign in'}).closest('form')!);
   expect(screen.getByRole('alert')).toHaveTextContent('12 to 128');
   expect(mockAuth).not.toHaveBeenCalled();
 });
 it('requires matching passwords before registration',()=>{
   render(<AuthForm mode="register"/>);
   fill('Full name','Owner');
   fill('Email address','owner@example.com');
   fill('Password','correctPassword123');
   fill('Confirm password','differentPassword123');
   fireEvent.submit(screen.getByRole('button',{name:'Create account'}).closest('form')!);
   expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match');
   expect(mockAuth).not.toHaveBeenCalled();
 });
 it('shows email verification instructions after registering',async()=>{
   mockAuth.mockResolvedValue({id:42,status:'PENDING_VERIFICATION'});
   render(<AuthForm mode="register"/>);
   fill('Full name','  Owner Example  ');
   fill('Email address','Owner@Example.com');
   fill('Password','correctPassword123');
   fill('Confirm password','correctPassword123');
   fireEvent.submit(screen.getByRole('button',{name:'Create account'}).closest('form')!);
   expect(await screen.findByRole('status')).toHaveTextContent('Check your email');
   expect(mockAuth).toHaveBeenCalledWith('register',{email:'owner@example.com',password:'correctPassword123',displayName:'Owner Example'});
   expect(screen.getByRole('link',{name:'Resend verification email'})).toHaveAttribute('href','/resend-verification');
 });
 it('uses a non-enumerating success message when resending verification',async()=>{
   mockAuth.mockResolvedValue({message:'Accepted'});
   render(<ResendVerificationForm/>);
   fill('Email address','owner@example.com');
   fireEvent.submit(screen.getByRole('button',{name:'Send verification link'}).closest('form')!);
   expect(await screen.findByRole('status')).toHaveTextContent('If this account is awaiting verification');
   expect(mockAuth).toHaveBeenCalledWith('resend-verification',{email:'owner@example.com'});
 });
 it('shows upstream login errors without navigating',async()=>{
   mockAuth.mockRejectedValue(new Error('Incorrect credentials or unavailable account.'));
   render(<AuthForm mode="login"/>);
   fill('Email address','owner@example.com');
   fill('Password','correctPassword123');
   fireEvent.submit(screen.getByRole('button',{name:'Sign in'}).closest('form')!);
   expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect credentials');
   expect(replace).not.toHaveBeenCalled();
 });
});
