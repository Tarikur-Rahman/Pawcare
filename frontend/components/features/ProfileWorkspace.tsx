'use client';

import {useEffect,useState} from 'react';
import {RefreshCw,Search,ShieldCheck} from 'lucide-react';
import {api} from '@/lib/api/client';
import {rows,str,type Row} from '@/lib/types/domain';
import {addressId,addressScope,isDefaultAddress,visibleAddresses} from '@/lib/account/records';
import {ProfileEditor} from '@/components/account/ProfileEditor';
import {AddressCreator} from '@/components/account/AddressCreator';
import {Button} from '@/components/ui/Button';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';

type AddressFilter='ALL'|'SHIPPING'|'BILLING';

export function ProfileWorkspace(){
 const [profile,setProfile]=useState<Row|null>(null),[profileLoading,setProfileLoading]=useState(true);
 const [profileError,setProfileError]=useState(''),[profileReload,setProfileReload]=useState(0);
 const [addresses,setAddresses]=useState<Row[]>([]),[addressesLoading,setAddressesLoading]=useState(true);
 const [addressesError,setAddressesError]=useState(''),[addressesReload,setAddressesReload]=useState(0);
 const [filter,setFilter]=useState<AddressFilter>('ALL'),[search,setSearch]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setProfileLoading(true);setProfileError('');
  api<Row>('/users/me',{signal:controller.signal}).then(value=>{
   if(controller.signal.aborted)return;
   if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('The profile response was invalid.');
   setProfile(value);
  }).catch(caught=>{if(!controller.signal.aborted)setProfileError(caught instanceof Error?caught.message:'Unable to load your profile.');})
   .finally(()=>{if(!controller.signal.aborted)setProfileLoading(false);});
  return ()=>controller.abort();
 },[profileReload]);
 useEffect(()=>{
  const controller=new AbortController();setAddressesLoading(true);setAddressesError('');
  api('/users/me/addresses',{signal:controller.signal}).then(value=>{
   if(!controller.signal.aborted)setAddresses(rows(value));
  }).catch(caught=>{if(!controller.signal.aborted)setAddressesError(caught instanceof Error?caught.message:'Unable to load saved addresses.');})
   .finally(()=>{if(!controller.signal.aborted)setAddressesLoading(false);});
  return ()=>controller.abort();
 },[addressesReload]);
 const visible=visibleAddresses(addresses,filter,search);
 return <section className="page-section">
  <div className="page-heading"><div><span className="eyebrow">PRIVATE ACCOUNT SETTINGS</span>
   <h1>Profile & addresses</h1><p>Update your contact preferences and saved shipping or billing addresses.</p></div></div>
  <div className="dashboard-lower account-layout"><div>
   <div className="panel account-profile-panel">
    <div className="medical-section-header"><div><h2>Your profile</h2><p>Your email and account role are managed by PawCare authentication.</p></div>
     <Button variant="secondary" disabled={profileLoading} onClick={()=>setProfileReload(n=>n+1)}><RefreshCw size={16} aria-hidden="true"/>Refresh</Button></div>
    {profileError&&<ErrorState message={profileError} onRetry={()=>setProfileReload(n=>n+1)}/>}
    {profileLoading&&!profile&&<p className="hint" role="status">Loading your profile…</p>}
    {profile&&!profileLoading&&!profileError&&<>
     <dl className="account-identity"><div><dt>Email (read-only)</dt><dd>{str(profile,'email')||'Not available'}</dd></div>
      <div><dt>Account role</dt><dd>{str(profile,'role')||'Not available'}</dd></div>
      <div><dt>Account status</dt><dd>{str(profile,'status')||'Not available'}</dd></div></dl>
     <ProfileEditor key={`${str(profile,'id')}-${profileReload}`} profile={profile} onSaved={setProfile}/>
    </>}
    {profileError&&profile&&<p className="hint">Last loaded profile is hidden until a successful refresh.</p>}
   </div>
   <div className="panel account-address-list-panel">
    <div className="medical-section-header"><div><h2>Saved addresses</h2><p>Private addresses for your own orders and billing.</p></div>
     <Button variant="secondary" disabled={addressesLoading} onClick={()=>setAddressesReload(n=>n+1)}><RefreshCw size={16} aria-hidden="true"/>Refresh addresses</Button></div>
    <div className="account-address-toolbar"><div className="medical-filters" aria-label="Filter addresses">
     {(['ALL','SHIPPING','BILLING'] as const).map(v=><button key={v} type="button" className={`medical-filter${filter===v?' selected':''}`} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{v==='ALL'?'All':v==='SHIPPING'?'Shipping':'Billing'}</button>)}
    </div><label className="account-address-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Search addresses</span>
     <input type="search" aria-label="Search addresses" className="form-input" placeholder="Search addresses" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    {addressesError&&<ErrorState message={addressesError} onRetry={()=>setAddressesReload(n=>n+1)}/>}
    {addressesLoading?<p className="hint" role="status">Loading addresses…</p>:addressesError?null
     :!addresses.length?<EmptyState title="No addresses saved" description="Add a shipping or billing address using the form."/>
     :!visible.length?<EmptyState title="No matching addresses" description="Try a different address type or search term."/>
     :<ul className="account-address-list">{visible.map((a,i)=><li key={addressId(a)||`address-${i}`} className="account-address-row">
       <div className="account-address-top"><strong>{str(a,'recipientName')||'Unnamed recipient'}</strong>
        <span className="badge badge-gray">{addressScope(a)==='OTHER'?'Address':addressScope(a)==='SHIPPING'?'Shipping':'Billing'}</span>
        {isDefaultAddress(a)&&<span className="badge badge-green">Default</span>}</div>
       <p>{[str(a,'line1'),str(a,'line2'),str(a,'city'),str(a,'region'),str(a,'postalCode'),str(a,'countryCode')].filter(Boolean).join(', ')}</p>
      </li>)}</ul>}
    <p className="hint account-address-limit">Address editing, deletion and default-address changes are not available in the current API.</p>
   </div>
  </div><div><div className="panel account-add-panel"><h2>Add an address</h2><p className="hint">Provide a recipient and delivery location. Addresses are not publicly displayed.</p>
   <AddressCreator onAdded={()=>setAddressesReload(n=>n+1)}/></div>
   <div className="panel account-security-panel"><ShieldCheck size={22} aria-hidden="true"/><div><h3>Account security</h3>
    <p className="hint">Email, passwords and account roles cannot be changed from this page. PawCare does not yet provide a password-change endpoint.</p></div></div>
  </div></div>
 </section>;
}
