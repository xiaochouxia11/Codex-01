import NextAuth from 'next-auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { authOptions } from '../../../lib/auth';

export default function handler(request: NextApiRequest, response: NextApiResponse) {
  const action = request.query.nextauth?.[0];
  // This example does not accept browser-originated messages as server diagnostics.
  if (action === '_log') {
    return response.status(404).end();
  }
  return NextAuth(request, response, authOptions());
}
