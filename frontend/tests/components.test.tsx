// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {render,screen} from '@testing-library/react';
import {Button} from '@/components/ui/Button';
import {EmptyState} from '@/components/ui/EmptyState';
import {StatusBadge} from '@/components/ui/StatusBadge';
import {formatMoney} from '@/lib/utils/currency';
import {normalizeUser} from '@/lib/types/domain';
describe('shared UI',()=>{
 it('renders a disabled pending button',()=>{render(<Button loading>Save</Button>);expect(screen.getByRole('button')).toBeDisabled();});
 it('shows an empty message',()=>{render(<EmptyState title="No listings"/>);expect(screen.getByText('No listings')).toBeInTheDocument();});
 it('shows text status without relying on color',()=>{render(<StatusBadge status="PENDING_REVIEW"/>);expect(screen.getByText('pending review')).toBeInTheDocument();});
 it('renders minor currency units',()=>{expect(formatMoney(129900,'BDT')).toContain('1,299');});
 it('normalizes backend uppercase property names',()=>{expect(normalizeUser({ROLE:'VET',USER_ID:4,DISPLAY_NAME:'Dr Mia'}).role).toBe('VET');});
});
