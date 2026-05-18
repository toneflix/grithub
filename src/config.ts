import 'dotenv/config'

import { parseAK } from './helpers'

export const config: {
    CLIENT_ID: string
    CLIENT_TYPE: 'oauth-app' | 'github-app'
    SCOPES: string[]
} = {
    CLIENT_ID: process.env.NODE_ENV === 'production'
        ? parseAK(process.env.GITHUB_CLIENT_ID!)
        : String(process.env.GITHUB_CLIENT_ID),
    CLIENT_TYPE: 'oauth-app',
    SCOPES: ['repo', 'read:user', 'user:email'],
}