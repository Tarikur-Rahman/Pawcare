import Link from 'next/link';
import {AdoptionDraftWorkspace} from '@/components/adoption/AdoptionDraftWorkspace';
import {AdoptionManagement} from '@/components/features/AdoptionManagement';

export default function Page(){return <section className="page-section">
 <div className="page-heading"><div><span className="eyebrow">PAWCARE COMMUNITY</span><h1>My adoptions</h1>
  <p>Create a draft, submit it for review, manage received applications and confirm safe handovers.</p></div>
  <Link href="/adopt" className="btn btn-secondary">Browse approved listings</Link></div>
 <div className="dashboard-lower adoption-owner-layout"><AdoptionDraftWorkspace/>
  <aside className="panel"><h2>How adoption works</h2>
   <ol className="adoption-steps"><li>Choose one of your active pets and save a private draft.</li>
    <li>Submit the draft for staff review. Only published listings appear publicly.</li>
    <li>Applicants submit private care plans; listing owners can review them by ID.</li>
    <li>Acceptance matches the applicant, but does not transfer the pet.</li>
    <li>Both the owner and the adopter confirm the final handover.</li></ol>
   <p className="hint">The backend does not expose a private listing-history endpoint. Keep the listing ID returned after creating a draft.</p>
  </aside></div><AdoptionManagement/>
 </section>;}
