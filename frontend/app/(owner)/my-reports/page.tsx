import Link from 'next/link';
import {LostFoundDraftWorkspace} from '@/components/lost-found/LostFoundDraftWorkspace';
import {LostFoundManagement} from '@/components/features/LostFoundManagement';
export default function Page(){return <section className="page-section">
 <div className="page-heading"><div><span className="eyebrow">PAWCARE COMMUNITY</span><h1>Lost &amp; found reports</h1>
  <p>Create a private report, read owner-authorized sightings and confirm a verified reunion.</p></div>
  <Link href="/lost-found" className="btn btn-secondary">Browse public reports</Link></div>
 <div className="dashboard-lower lostfound-owner-layout"><LostFoundDraftWorkspace/>
  <aside className="panel"><h2>How reports work</h2><ol className="adoption-steps">
   <li>Save a private lost or found report and keep the returned ID.</li>
   <li>Reports remain drafts until moderation publishes them. There is no self-submit endpoint for lost/found drafts.</li>
   <li>After publication, other users can send private sightings or claims with valid evidence.</li>
   <li>Moderators verify ownership evidence; both parties separately confirm the reunion.</li></ol>
   <p className="hint">There is no private report-history endpoint. This page cannot recover previously created draft IDs.</p>
  </aside></div><LostFoundManagement/>
 </section>;}
