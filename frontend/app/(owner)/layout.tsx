import {requireRole} from '@/lib/auth/session';
import {AppShell} from '@/components/layout/AppShell';
export default async function Layout({children}:{children:React.ReactNode}){const user=await requireRole(['OWNER']);return <AppShell user={user} area="owner">{children}</AppShell>;}