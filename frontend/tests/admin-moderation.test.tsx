// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {api} from '@/lib/api/client';
import {ModerationQueue} from '@/components/admin/ModerationQueue';
import {AdminUsersWorkspace} from '@/components/admin/AdminUsersWorkspace';
import {VerificationWorkspace} from '@/components/features/VerificationWorkspace';
import {
 adminId,adminReason,AdminValidationError,activationPayload,grantPayload,revokePayload,claimVerifyPayload,
 decisionPayload,isPendingOwner,isActiveUser,validReport,filterReports,filterUsers,CAPABILITIES,REVIEW_TYPES
} from '@/lib/admin/operations';
import type {Row} from '@/lib/types/domain';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const users:Row[]=[
 {id:12,email:'pending@example.test',role:'OWNER',status:'PENDING_VERIFICATION'},
 {id:13,email:'active@example.test',role:'OWNER',status:'ACTIVE'},
 {id:14,email:'vet@example.test',role:'VET',status:'ACTIVE'},
 {id:15,email:'admin@example.test',role:'ADMIN',status:'ACTIVE'},
];
const reportQueue:Row[]=[
 {id:51,entityType:'ADOPTION',entityId:101,reasonCode:'PRIVACY',status:'OPEN',createdAt:'2026-11-08T00:00:00Z'},
 {id:52,entityType:'PET_SALE',entityId:202,reasonCode:'FRAUD',status:'IN_REVIEW',createdAt:'2026-11-08T01:00:00Z'},
];
function usersApi(){mockApi.mockImplementation(async(path,opts)=>{
 if(path==='/admin/users')return users as never;
 if(path==='/admin/users/12/activate'&&opts?.method==='POST')return {id:12,status:'ACTIVE'} as never;
 if(path==='/admin/users/13/capabilities'&&opts?.method==='POST')return {id:91,capability:'APPROVED_SELLER',status:'ACTIVE'} as never;
 if(path==='/admin/capabilities/91/revoke'&&opts?.method==='POST')return {id:91,status:'REVOKED'} as never;
 if(path==='/admin/reunification-claims/41/verify'&&opts?.method==='POST')return {id:41,status:'VERIFIED'} as never;
 throw new Error('Unexpected request '+path);
});}
function moderationApi(){mockApi.mockImplementation(async(path,opts)=>{
 if(path==='/admin/moderation')return reportQueue as never;
 if(path==='/admin/moderation/decision'&&opts?.method==='POST')return {id:101,status:'PUBLISHED'} as never;
 throw new Error('Unexpected request '+path);
});}
function fillModeration(type='ADOPTION',id='101',decision='approve',reason='EVIDENCE_REVIEWED'){
 fireEvent.change(screen.getByRole('combobox',{name:/Listing type/}),{target:{value:type}});
 fireEvent.change(screen.getByRole('textbox',{name:/Listing ID/}),{target:{value:id}});
 fireEvent.change(screen.getByRole('combobox',{name:/Decision/}),{target:{value:decision}});
 fireEvent.change(screen.getByRole('textbox',{name:/Audit reason/}),{target:{value:reason}});
}
function chooseGrant(){
 fireEvent.change(screen.getByRole('combobox',{name:/Active account/}),{target:{value:'13'}});
 fireEvent.change(screen.getByRole('combobox',{name:/Capability \*/}),{target:{value:'APPROVED_SELLER'}});
 fireEvent.change(screen.getByRole('textbox',{name:/Reviewer-approved evidence file ID/}),{target:{value:'99'}});
 fireEvent.change(screen.getByRole('textbox',{name:/Audit reason/}),{target:{value:'IDENTITY_CHECKED'}});
}

beforeEach(()=>{mockApi.mockReset();});
afterEach(()=>cleanup());

describe('Administrator contract guards',()=>{
 it('accepts safe Oracle identifiers and canonicalizes leading zeroes',()=>{
  expect(adminId(' 007 ')).toBe('7');expect(adminId(9007199254740991)).toBe('9007199254740991');
 });
 it('rejects malformed, unsafe and injection-like IDs',()=>{
  for(const x of ['1/delete','../1','0','-1','1.2','2e3','9007199254740993',null,undefined])expect(adminId(x)).toBe('');
 });
 it('trims the audit reason and enforces UTF-8 bytes',()=>{
  expect(adminReason(' evidence_approved ')).toBe('evidence_approved');
  expect(()=>adminReason('  ')).toThrow(AdminValidationError);
  expect(()=>adminReason('🐾'.repeat(21))).toThrow(/80 UTF-8/);
 });
 it('requires a pending OWNER and independently reviewed identity before activation',()=>{
  expect(isPendingOwner(users[0])).toBe(true);expect(isPendingOwner(users[1])).toBe(false);
  expect(()=>activationPayload(users[0],false,'IDENTITY')).toThrow(/identity review/);
  expect(()=>activationPayload(users[1],true,'IDENTITY')).toThrow(/pending owner/);
  expect(activationPayload(users[0],true,'IDENTITY')).toEqual({identityReviewed:true,reasonCode:'IDENTITY'});
 });
 it('never grants privileges to inactive users or through an unapproved capability code',()=>{
  expect(isActiveUser(users[1])).toBe(true);expect(isActiveUser(users[0])).toBe(false);
  expect(()=>grantPayload(users[0],'APPROVED_SELLER',99,'REVIEW')).toThrow(/active user/);
  expect(()=>grantPayload(users[1],'APPROVED_PET_SELLER',99,'REVIEW')).toThrow(/capability/);
  expect(CAPABILITIES).toEqual(['APPROVED_SELLER','STORE_OPERATOR','VERIFIED_BENEFICIARY']);
 });
 it('builds the exact audited capability-grant contract',()=>{
  expect(grantPayload(users[1],'approved_seller','99','APPROVED')).toEqual({capability:'APPROVED_SELLER',evidenceFileId:99,reasonCode:'APPROVED'});
  expect(()=>grantPayload(users[1],'APPROVED_SELLER','../../5','OK')).toThrow(/evidence/);
 });
 it('builds the exact capability-revocation and reunion contracts',()=>{
  expect(revokePayload('091','REVIEW')).toEqual({id:91,body:{reasonCode:'REVIEW'}});
  expect(claimVerifyPayload('41','SAFE_PROOF')).toEqual({id:41,body:{reasonCode:'SAFE_PROOF'}});
  expect(()=>revokePayload('0','REVIEW')).toThrow();expect(()=>claimVerifyPayload('../41','REVIEW')).toThrow();
 });
 it('allows listing moderation only for the backend review types and exact body',()=>{
  expect(REVIEW_TYPES).toEqual(['ADOPTION','PET_SALE','LOST_FOUND','DONATION','FOOD_PRODUCT']);
  expect(decisionPayload('pet_sale','202',false,'WELFARE_RISK')).toEqual({entityType:'PET_SALE',entityId:202,approve:false,reasonCode:'WELFARE_RISK'});
  expect(()=>decisionPayload('USER','2',true,'REVIEW')).toThrow();
  expect(()=>decisionPayload('ADOPTION','2/approve',true,'REVIEW')).toThrow();
  expect(()=>decisionPayload('ADOPTION','2',true,'')).toThrow();
 });
 it('does not mistake a report ID for the listing ID',()=>{
  expect(validReport(reportQueue[0])).toBe(true);
  expect(validReport({...reportQueue[0],id:0})).toBe(false);
  expect(validReport({...reportQueue[0],entityId:'../../1'})).toBe(false);
  expect(validReport({...reportQueue[0],status:'CLOSED'})).toBe(false);
 });
 it('filters report and user directories without mutating their data',()=>{
  expect(filterReports(reportQueue,'fraud','PET_SALE').map(x=>x.id)).toEqual([52]);
  expect(filterReports(reportQueue,'101').map(x=>x.id)).toEqual([51]);
  expect(filterUsers(users,'pending','PENDING_VERIFICATION').map(x=>x.id)).toEqual([12]);
  expect(filterUsers(users,'vet','ACTIVE').map(x=>x.id)).toEqual([14]);
  expect(reportQueue).toHaveLength(2);expect(users).toHaveLength(4);
 });
 it('maps store reporting fields to the actual currency-level backend contract',()=>{
  const view=readFileSync(join(process.cwd(),'app/(admin)/admin/reports/page.tsx'),'utf8');
  const service=readFileSync(join(process.cwd(),'../backend/PawCare.Api/Modules/Reports/ReportsService.cs'),'utf8');
  expect(view).toContain('verifiedCapturedMinor');
  expect(view).not.toContain("['day','Day']");
  expect(service).toContain('verifiedCapturedMinor');
 });
 it('retains role-restricted admin layout and no privileged client-side API bypass',()=>{
  const layout=readFileSync(join(process.cwd(),'app/(admin)/layout.tsx'),'utf8');
  const endpoints=readFileSync(join(process.cwd(),'../backend/PawCare.Api/Modules/Admin/AdminEndpoints.cs'),'utf8');
  const moderation=readFileSync(join(process.cwd(),'../backend/PawCare.Api/Modules/Moderation/ModerationEndpoints.cs'),'utf8');
  expect(layout).toContain("requireRole(['ADMIN'])");
  expect(endpoints).toContain('RequireAuthorization("AdminOnly")');
  expect(moderation).toContain('RequireAuthorization("AdminOnly")');
 });
});

describe('Reported content queue vs pending listing decisions',()=>{
 it('loads only the admin report queue and does not expose per-report approve or reject actions',async()=>{
  moderationApi();render(<ModerationQueue/>);
  expect(await screen.findByText(/Report #51/)).toBeInTheDocument();
  expect(screen.getByText(/Report #52/)).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Approve'})).not.toBeInTheDocument();
  expect(screen.getByText(/no report-case decision endpoint/)).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledWith('/admin/moderation',{signal:expect.any(AbortSignal)});
 });
 it('filters reported content without a second fetch',async()=>{
  moderationApi();render(<ModerationQueue/>);await screen.findByText(/Report #51/);
  fireEvent.change(screen.getByRole('combobox',{name:'Filter by listing type'}),{target:{value:'PET_SALE'}});
  // The filter is the first type selector; listing decision's type selector is separate.
  expect(screen.queryByText(/Report #51/)).not.toBeInTheDocument();
  expect(screen.getByText(/Report #52/)).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledTimes(1);
 });
 it('requires explicit confirmation before a pending listing review POST',async()=>{
  moderationApi();render(<ModerationQueue/>);await screen.findByText(/Report #51/);
  fillModeration();fireEvent.click(screen.getByRole('button',{name:'Review decision'}));
  expect(screen.getByRole('group',{name:'Confirm listing decision'})).toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalledWith('/admin/moderation/decision',expect.anything());
  fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));
  expect(mockApi).not.toHaveBeenCalledWith('/admin/moderation/decision',expect.anything());
 });
 it('posts the exact listing decision separately from a report-state change',async()=>{
  moderationApi();render(<ModerationQueue/>);await screen.findByText(/Report #51/);
  fillModeration();fireEvent.click(screen.getByRole('button',{name:'Review decision'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm listing decision'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/admin/moderation/decision',{method:'POST',body:{entityType:'ADOPTION',entityId:101,approve:true,reasonCode:'EVIDENCE_REVIEWED'}}));
  expect(await screen.findByText(/backend confirmed PUBLISHED/)).toBeInTheDocument();
  expect(await screen.findByText(/Report #51/)).toBeInTheDocument();
 });
 it('supports a separate rejection decision body for listing review',async()=>{
  moderationApi();render(<ModerationQueue/>);await screen.findByText(/Report #51/);
  fillModeration('PET_SALE','202','reject','WELFARE_RISK');fireEvent.click(screen.getByRole('button',{name:'Review decision'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm listing decision'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/admin/moderation/decision',{method:'POST',body:{entityType:'PET_SALE',entityId:202,approve:false,reasonCode:'WELFARE_RISK'}}));
 });
 it('rejects unsafe listing IDs before network actions',async()=>{
  moderationApi();render(<ModerationQueue/>);await screen.findByText(/Report #51/);
  fillModeration('ADOPTION','../../202','approve','REVIEW');fireEvent.click(screen.getByRole('button',{name:'Review decision'}));
  expect(screen.getByRole('alert')).toHaveTextContent(/safe positive listing ID/);
  expect(mockApi).not.toHaveBeenCalledWith('/admin/moderation/decision',expect.anything());
 });
 it('reports a failed listing decision without claiming a status change',async()=>{
  mockApi.mockImplementation(async(path,opts)=>{
   if(path==='/admin/moderation')return reportQueue as never;
   if(path==='/admin/moderation/decision'&&opts?.method==='POST')throw new Error('Listing not awaiting review');
   throw new Error('Unexpected request');
  });
  render(<ModerationQueue/>);await screen.findByText(/Report #51/);
  fillModeration();fireEvent.click(screen.getByRole('button',{name:'Review decision'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm listing decision'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Listing not awaiting review');
  expect(screen.queryByText(/backend confirmed/)).not.toBeInTheDocument();
 });
 it('shows retryable queue outage rather than saying the report queue is clear',async()=>{
  mockApi.mockRejectedValueOnce(new Error('Moderator unavailable')).mockResolvedValue(reportQueue as never);
  render(<ModerationQueue/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Moderator unavailable');
  expect(screen.queryByText('No open content reports')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  expect(await screen.findByText(/Report #51/)).toBeInTheDocument();
 });
 it('does not show unsafe or already closed report rows',async()=>{
  mockApi.mockResolvedValue([...reportQueue,{id:53,entityType:'ADOPTION',entityId:'../51',status:'OPEN'},{id:54,entityType:'ADOPTION',entityId:1,status:'CLOSED'}] as never);
  render(<ModerationQueue/>);await screen.findByText(/Report #51/);
  expect(screen.queryByText(/Report #53/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Report #54/)).not.toBeInTheDocument();
 });
});

describe('Admin user directory and verified activation',()=>{
 it('loads recent admin users and offers activation only for pending owners',async()=>{
  usersApi();render(<AdminUsersWorkspace/>);
  expect(await screen.findByText(/pending@example.test/)).toBeInTheDocument();
  expect(screen.getAllByRole('button',{name:'Review activation'})).toHaveLength(1);
  expect(mockApi).toHaveBeenCalledWith('/admin/users',{signal:expect.any(AbortSignal)});
 });
 it('filters users locally by email and status',async()=>{
  usersApi();render(<AdminUsersWorkspace/>);await screen.findByText(/pending@example.test/);
  fireEvent.change(screen.getByRole('searchbox',{name:'Search accounts'}),{target:{value:'vet@'}});
  expect(screen.getByText(/vet@example.test/)).toBeInTheDocument();
  expect(screen.queryByText(/pending@example.test/)).not.toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledTimes(1);
 });
 it('does not activate when manual identity review is unchecked',async()=>{
  usersApi();render(<AdminUsersWorkspace/>);await screen.findByText(/pending@example.test/);
  fireEvent.click(screen.getByRole('button',{name:'Review activation'}));
  fireEvent.change(screen.getByRole('textbox',{name:/Audit reason/}),{target:{value:'IDENTITY_APPROVED'}});
  fireEvent.click(screen.getByRole('button',{name:'Review activation request'}));
  expect(screen.getByRole('alert')).toHaveTextContent(/Complete identity review/);
  expect(mockApi).not.toHaveBeenCalledWith('/admin/users/12/activate',expect.anything());
 });
 it('requires confirmation and posts exactly identityReviewed and reasonCode',async()=>{
  usersApi();render(<AdminUsersWorkspace/>);await screen.findByText(/pending@example.test/);
  fireEvent.click(screen.getByRole('button',{name:'Review activation'}));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByRole('textbox',{name:/Audit reason/}),{target:{value:'MANUAL_ID_CHECK'}});
  fireEvent.click(screen.getByRole('button',{name:'Review activation request'}));
  expect(mockApi).not.toHaveBeenCalledWith('/admin/users/12/activate',expect.anything());
  fireEvent.click(screen.getByRole('button',{name:'Confirm activation'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/admin/users/12/activate',{method:'POST',body:{identityReviewed:true,reasonCode:'MANUAL_ID_CHECK'}}));
  expect(await screen.findByText(/backend confirmed ACTIVE/)).toBeInTheDocument();
 });
 it('lets the admin decline activation confirmation without sending a mutation',async()=>{
  usersApi();render(<AdminUsersWorkspace/>);await screen.findByText(/pending@example.test/);
  fireEvent.click(screen.getByRole('button',{name:'Review activation'}));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByRole('textbox',{name:/Audit reason/}),{target:{value:'MANUAL_CHECK'}});
  fireEvent.click(screen.getByRole('button',{name:'Review activation request'}));
  fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));
  expect(mockApi).not.toHaveBeenCalledWith('/admin/users/12/activate',expect.anything());
 });
 it('retains fields and shows server errors instead of false activation success',async()=>{
  mockApi.mockImplementation(async(path,opts)=>{
   if(path==='/admin/users'&&!opts?.method)return users as never;
   if(path==='/admin/users/12/activate')throw new Error('Identity review rejected');
   throw new Error('Unexpected request');
  });
  render(<AdminUsersWorkspace/>);await screen.findByText(/pending@example.test/);
  fireEvent.click(screen.getByRole('button',{name:'Review activation'}));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByRole('textbox',{name:/Audit reason/}),{target:{value:'MANUAL_CHECK'}});
  fireEvent.click(screen.getByRole('button',{name:'Review activation request'}));fireEvent.click(screen.getByRole('button',{name:'Confirm activation'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Identity review rejected');
  expect(screen.getByRole('textbox',{name:/Audit reason/})).toHaveValue('MANUAL_CHECK');
  expect(screen.queryByText(/backend confirmed ACTIVE/)).not.toBeInTheDocument();
 });
 it('shows an honest retryable user-directory failure',async()=>{
  mockApi.mockRejectedValueOnce(new Error('Directory unreachable')).mockResolvedValue(users as never);
  render(<AdminUsersWorkspace/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Directory unreachable');
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  expect(await screen.findByText(/pending@example.test/)).toBeInTheDocument();
 });
});

describe('Manual capability and reunion verification actions',()=>{
 it('loads only active accounts for capability grants and uses the backend seller code',async()=>{
  usersApi();render(<VerificationWorkspace/>);
  expect(await screen.findByRole('option',{name:/active@example.test/})).toBeInTheDocument();
  expect(screen.queryByRole('option',{name:/pending@example.test/})).not.toBeInTheDocument();
  expect(screen.getByRole('option',{name:'APPROVED_SELLER'})).toBeInTheDocument();
  expect(screen.queryByRole('option',{name:'APPROVED_PET_SELLER'})).not.toBeInTheDocument();
 });
 it('requires a separate confirmation for a documented capability grant',async()=>{
  usersApi();render(<VerificationWorkspace/>);await screen.findByRole('option',{name:/active@example.test/});
  chooseGrant();fireEvent.click(screen.getByRole('button',{name:'Review verification request'}));
  expect(mockApi).not.toHaveBeenCalledWith('/admin/users/13/capabilities',expect.anything());
  fireEvent.click(screen.getByRole('button',{name:'Confirm verification action'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/admin/users/13/capabilities',{method:'POST',body:{capability:'APPROVED_SELLER',evidenceFileId:99,reasonCode:'IDENTITY_CHECKED'}}));
  expect(await screen.findByText(/Backend confirmed ACTIVE/)).toBeInTheDocument();
 });
 it('does not allow unsafe evidence-file IDs or unreviewed uploads to be auto-approved',async()=>{
  usersApi();render(<VerificationWorkspace/>);await screen.findByRole('option',{name:/active@example.test/});
  chooseGrant();fireEvent.change(screen.getByRole('textbox',{name:/Reviewer-approved evidence file ID/}),{target:{value:'../../99'}});
  fireEvent.click(screen.getByRole('button',{name:'Review verification request'}));
  expect(screen.getByRole('alert')).toHaveTextContent(/safe positive reviewer-approved/);
  expect(mockApi).not.toHaveBeenCalledWith('/admin/users/13/capabilities',expect.anything());
 });
 it('posts revocation through the exact capability grant path after confirmation',async()=>{
  usersApi();render(<VerificationWorkspace/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Action'}),{target:{value:'revoke'}});
  fireEvent.change(screen.getByRole('textbox',{name:/Existing capability grant ID/}),{target:{value:'91'}});
  fireEvent.change(screen.getByRole('textbox',{name:/Audit reason/}),{target:{value:'ACCESS_REVOKED'}});
  fireEvent.click(screen.getByRole('button',{name:'Review verification request'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm verification action'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/admin/capabilities/91/revoke',{method:'POST',body:{reasonCode:'ACCESS_REVOKED'}}));
  expect(await screen.findByText(/Backend confirmed REVOKED/)).toBeInTheDocument();
 });
 it('posts reunion verification by claim ID only after confirmation',async()=>{
  usersApi();render(<VerificationWorkspace/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Action'}),{target:{value:'reunion'}});
  fireEvent.change(screen.getByRole('textbox',{name:/Submitted reunion claim ID/}),{target:{value:'41'}});
  fireEvent.change(screen.getByRole('textbox',{name:/Audit reason/}),{target:{value:'PROOF_REVIEWED'}});
  fireEvent.click(screen.getByRole('button',{name:'Review verification request'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm verification action'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/admin/reunification-claims/41/verify',{method:'POST',body:{reasonCode:'PROOF_REVIEWED'}}));
  expect(await screen.findByText(/Backend confirmed VERIFIED/)).toBeInTheDocument();
 });
 it('rejects an unsafe capability ID without a mutation',()=>{
  usersApi();render(<VerificationWorkspace/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Action'}),{target:{value:'revoke'}});
  fireEvent.change(screen.getByRole('textbox',{name:/Existing capability grant ID/}),{target:{value:'91/../../admin'}});
  fireEvent.change(screen.getByRole('textbox',{name:/Audit reason/}),{target:{value:'REVIEW'}});
  fireEvent.click(screen.getByRole('button',{name:'Review verification request'}));
  expect(screen.getByRole('alert')).toHaveTextContent(/safe positive capability grant ID/);
  expect(mockApi).not.toHaveBeenCalledWith('/admin/capabilities/91/revoke',expect.anything());
 });
 it('preserves verification input and shows a server rejection',async()=>{
  mockApi.mockImplementation(async(path,opts)=>{
   if(path==='/admin/users')return users as never;
   if(path==='/admin/capabilities/99/revoke'&&opts?.method==='POST')throw new Error('Capability not active');
   throw new Error('Unexpected request');
  });
  render(<VerificationWorkspace/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Action'}),{target:{value:'revoke'}});
  fireEvent.change(screen.getByRole('textbox',{name:/Existing capability grant ID/}),{target:{value:'99'}});
  fireEvent.change(screen.getByRole('textbox',{name:/Audit reason/}),{target:{value:'CASE_42'}});
  fireEvent.click(screen.getByRole('button',{name:'Review verification request'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm verification action'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Capability not active');
  expect(screen.getByRole('textbox',{name:/Audit reason/})).toHaveValue('CASE_42');
  expect(screen.queryByText(/Backend confirmed/)).not.toBeInTheDocument();
 });
 it('never invents capability or reunion index data',async()=>{
  usersApi();render(<VerificationWorkspace/>);await screen.findByRole('option',{name:/active@example.test/});
  expect(screen.getByText(/no capability-grant history or reunion-claim index endpoint/)).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledTimes(1);
 });
});
