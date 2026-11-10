import Link from 'next/link';
import {SaleDraftWorkspace} from '@/components/marketplace/SaleDraftWorkspace';
import {MarketplaceInquiries} from '@/components/features/MarketplaceInquiries';
export default function Page(){return <section className="page-section"><div className="page-heading"><div>
 <span className="eyebrow">PAWCARE COMMUNITY</span><h1>My marketplace activity</h1>
 <p>Verified sellers can prepare and submit listings for moderation. Anyone signed in can view their own authorized inquiries.</p></div>
 <Link href="/marketplace" className="btn btn-secondary">Browse approved listings</Link></div>
 <div className="dashboard-lower"><SaleDraftWorkspace/><aside className="panel"><h2>Responsible marketplace process</h2>
 <ol className="adoption-steps"><li>Have staff verify seller eligibility and grant APPROVED_PET_SELLER.</li>
  <li>Choose one of your active pets and a SAFE, reviewer-only welfare evidence file.</li>
  <li>Save a private draft and retain its ID.</li><li>Submit it for staff moderation; only approved ACTIVE listings appear publicly.</li>
  <li>Interested members may send private inquiries. No final sale, payment, shipping or ownership transfer is supported.</li></ol>
 <p className="hint">This API does not expose seller listing history, a public seller identity, payment, or a private buyer contact directory.</p></aside></div>
 <MarketplaceInquiries/></section>;}
