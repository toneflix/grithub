import { IRepoEntry } from 'src/Contracts/Interfaces'
import { execSync } from 'child_process'

/**
 * Try to extract GitHub credentials (token) for the current repo using git credential fill.
 * Returns { username, password } if found, or null if not available.
 * 
 * @returns 
 */
export function getGitCredentialForCurrentRepo (opts?: { reuseSshCredential?: boolean }) {
    const repo = detectCurrentGitRepo()
    if (!repo) return null

    // For SSH remotes git authenticates with an SSH key, not an API-usable token,
    // so `git credential fill` resolves an unrelated cached HTTPS credential which
    // may belong to a different account than the one used for normal git operations.
    // Reusing it for SSH remotes is opt-in (`reuseSshCredential`); otherwise we skip
    // the lookup and let the caller fall back to the logged-in user token.
    let remoteUrl: string
    try {
        remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim()
    } catch {
        return null
    }
    const isSsh = !/^https?:\/\//.test(remoteUrl)
    if (isSsh && !opts?.reuseSshCredential) return null

    try {
        // repo.clone_url is always HTTPS (SSH remotes are converted to HTTPS).
        const input = `url=${repo.clone_url}\n\n`
        const output = execSync('git credential fill', {
            input,
            encoding: 'utf8'
        })

        const usernameMatch = output.match(/^username=(.*)$/m)
        const passwordMatch = output.match(/^password=(.*)$/m)
        if (usernameMatch && passwordMatch) {
            return {
                username: usernameMatch[1],
                password: passwordMatch[1],
            }
        }
    } catch {/** */ }

    return null
}

/**
 * Detects the current git repository in the workspace, returning owner/repo and remote URL if found.
 * Returns null if not in a git repo.
 * 
 * @returns 
 */
export const detectCurrentGitRepo = (): IRepoEntry | null => {
    try {
        // Get remote URL
        const remoteUrl = execSync('git config --get remote.origin.url', {
            encoding: 'utf8'
        }).trim()

        if (!remoteUrl) return null

        // Parse owner/repo from URL
        const match = remoteUrl.match(/[:/]([^/]+)\/([^/.]+)(?:\.git)?$/)
        if (!match) return null
        const owner = match[1]
        const name = match[2]

        const ssh_url = remoteUrl.startsWith('git@')
            ? remoteUrl
            : `git@${remoteUrl.replace(/^https?:\/\//, '')}.git`.replace(/\.git\.git$/, '.git')

        const clone_url = remoteUrl.startsWith('http')
            ? remoteUrl
            : `https://${remoteUrl.replace(/^git@/, '').replace(':', '/')}.git`.replace(/\.git\.git$/, '.git')

        return {
            id: 0,
            name,
            full_name: `${owner}/${name}`,
            private: false,
            ssh_url,
            clone_url,
        }
    } catch {
        return null
    }
} 
