import {validEmail,validPassword} from '../src/lib/validation/forms';
import {normalizeAccount} from '../src/lib/models/domain';
import {storeTokens,getAccessToken,clearTokens} from '../src/lib/auth/secureTokens';
describe('authentication primitives',()=>{
 it('rejects invalid email addresses',()=>{expect(validEmail('invalid')).toBe(false);expect(validEmail('owner@example.com')).toBe(true);});
 it('requires strong length',()=>{expect(validPassword('short')).toBe(false);expect(validPassword('very-long-passphrase!')).toBe(true);});
 it('normalizes Oracle result key casing and role',()=>{expect(normalizeAccount({ID:17,ROLE:'vet',STATUS:'ACTIVE',DISPLAY_NAME:'Dr. Moon'}).role).toBe('VET');});
 it('stores then clears the access token',async()=>{await storeTokens('access','refresh');expect(await getAccessToken()).toBe('access');await clearTokens();expect(await getAccessToken()).toBeNull();});
});
