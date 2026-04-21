import { NextRequest } from 'next/server';
import { getAuthUserFromRequest } from 'src/lib/auth';

export async function verifyAuthToken(req: NextRequest): Promise<string | null> {
  const auth = await getAuthUserFromRequest();
  return auth ? auth.user.id : null;
}