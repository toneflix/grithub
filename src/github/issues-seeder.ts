import { IIssue, IIssueFile, IIssueMetadata } from 'src/Contracts/Interfaces'
import { useCommand, useOctokit } from 'src/hooks'

import { Command } from '@h3ravel/musket'
import { Logger } from '@h3ravel/shared'
import dns from 'dns/promises'
import fs from 'fs'
import path from 'path'

/**
 * GitHub Issues Creator
 * 
 * This script reads markdown issue files from the issues directory
 * and creates them as GitHub issues using the GitHub API.
 */
export class IssuesSeeder {
    private command: Command

    private normalizeIssuePath (value: string): string {
        return value
            .replaceAll('\\', '/')
            .replace(/^\.\//, '')
    }

    constructor() {
        const [command] = useCommand()
        this.command = command()
    }

    /**
     * Set filename in issue content
     * 
     * @param content 
     * @param fileName 
     */
    setFilePath (content: string, filePath?: string): string {
        if (!filePath) return content

        const normalizedPath = this.normalizeIssuePath(filePath)

        if (content.includes('<!-- ghit#filepath:')) {
            content = content.replace(/<!--\s*ghit#filepath:\s*.+?\s*-->/i, `<!-- ghit#filepath: ${normalizedPath} -->`)
        } else {
            content = `<!-- ghit#filepath: ${normalizedPath} -->\n\n` + content
        }

        return content
    }

    /**
     * Get filename from issue content
     * 
     * @param content 
     * @returns 
     */
    getFilePath (content: string): string | undefined {
        const fileNameRegex = /<!--\s*ghit#filepath:\s*(.+?)\s*-->/i
        const match = content.match(fileNameRegex)

        if (match) {
            return this.normalizeIssuePath(match[1].trim())
        }

        return undefined
    }

    /**
     * Parse frontmatter from markdown file
     * 
     * @param content 
     * @returns 
     */
    parseFrontmatter (content: string) {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
        const match = content.match(frontmatterRegex)

        if (!match) {
            return { metadata: {}, body: content }
        }

        const [, frontmatter, body] = match
        const metadata: IIssueMetadata = {}

        // Parse frontmatter fields
        const lines = frontmatter.split('\n')
        let currentKey: keyof IIssueMetadata | null = null

        for (const line of lines) {
            const keyValueMatch = line.match(/^(\w+):\s*['"]?(.*?)['"]?$/) as [
                string,
                keyof IIssueMetadata,
                keyof IIssueMetadata['type']
            ] | null

            if (keyValueMatch) {
                const [, key, value] = keyValueMatch
                currentKey = key
                metadata[key] = value
            } else if (currentKey && line.trim()) {
                // Handle multi-line values
                metadata[currentKey] += '\n' + line.trim()
            }
        }

        return { metadata, body: body.trim() }
    }

    /**
     * Create a GitHub issue
     * 
     * @param entry 
     * @param owner 
     * @param repo 
     * @returns 
     */
    async updateIssue (entry: IIssueFile, issue: IIssue, owner: string, repo: string): Promise<IIssue> {
        try {
            const body = entry.filePath
                ? this.setFilePath(entry.body ?? '', entry.filePath)
                : entry.body ?? ''

            const { data } = await useOctokit().issues.update({
                body,
                repo,
                owner,
                issue_number: issue.number,
                title: entry.title,
                labels: entry.labels || [],
                assignees: entry.assignees || []
            })

            return data
        } catch (error: any) {
            throw this.requestError(error, owner, repo)
        }
    }

    /**
     * Create a GitHub issue
     * 
     * @param entry 
     * @param owner 
     * @param repo 
     * @returns 
     */
    async createIssue (entry: IIssueFile, owner: string, repo: string): Promise<IIssue> {
        try {
            const body = entry.filePath
                ? this.setFilePath(entry.body ?? '', entry.filePath)
                : entry.body ?? ''

            const { data } = await useOctokit().issues.create({
                body,
                repo,
                owner,
                type: entry.type,
                title: entry.title,
                labels: entry.labels || [],
                assignees: entry.assignees || []
            })

            return data
        } catch (error: any) {
            throw this.requestError(error, owner, repo)
        }
    }

    /**
     * Read all issue files from a directory
     */
    getIssueFiles (dir: string): string[] {
        const files: string[] = []
        const spinner = this.command.spinner('Reading issue files...').start()

        const traverse = (currentDir: string) => {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true })

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name)

                if (entry.isDirectory()) {
                    traverse(fullPath)
                } else if (entry.isFile() && entry.name.endsWith('.md')) {
                    files.push(fullPath)
                }
            }
        }

        traverse(dir)

        // Sort to maintain order
        const sortedFiles = files.sort()

        spinner.succeed(`Found ${sortedFiles.length} issue files`)

        if (sortedFiles.length === 0) {
            spinner.info('No issue files found. Exiting.')
            process.exit(0)
        }

        return sortedFiles
    }

    /**
     * Prepare issue data from file content and metadata
     * 
     * @param content The content of the issue file
     * @param relativePath The relative path of the issue file
     * @param fileName The name of the issue file
     * @returns The prepared issue data
     */
    prepareIssue (content: string, relativePath: string, fileName: string): IIssueFile {
        const { metadata, body } = this.parseFrontmatter(content)

        // Parse labels
        let labels: string[] = []

        if (metadata.labels) {
            labels = metadata.labels
                .split(',')
                .map(l => l.trim())
                .filter(l => l)
        }

        // Add wave label
        // labels.push(wave)

        // Parse assignees
        let assignees: string[] = []
        if (metadata.assignees && metadata.assignees.trim()) {
            assignees = metadata.assignees
                .split(',')
                .map(a => a.trim())
                .filter(a => a)
        }

        return {
            filePath: this.normalizeIssuePath(relativePath),
            title: metadata.title || metadata.name || fileName,
            type: metadata.type,
            body: body,
            labels: labels,
            assignees: assignees,
            // wave: wave,
            fileName: fileName
        }
    }

    /**
     * Process a single issue file
     * 
     * @param filePath The path to the issue file
     * @returns 
     */
    processIssueFile (filePath: string): IIssueFile {
        const configuredPath = this.command.argument('path', 'issues')
        const directory = path.isAbsolute(configuredPath)
            ? configuredPath
            : path.resolve(process.cwd(), configuredPath)
        const content = fs.readFileSync(filePath, 'utf-8')

        // Extract wave and issue number from path
        let relativePath = path.relative(directory, filePath)
        if (path.isAbsolute(relativePath)) {
            relativePath = path.relative(process.cwd(), filePath)
        }
        // const pathParts = relativePath.split(path.sep)
        // const wave = pathParts[0] // e.g., 'wave-1'
        const fileName = path.basename(filePath, '.md')

        return this.prepareIssue(content, relativePath, fileName)
    }

    /**
     * Process a markdown file containing multiple issues separated by '++++++' or '======' lines
     * 
     * @param filePath 
     * @returns 
     */
    processMultiIssueMarkdown (filePath: string): IIssueFile[] {
        try {
            const content = fs.readFileSync(filePath, 'utf-8')

            // Split on '++++++' or '======' that are on their own line
            const rawIssues = content.split(/\n(\+{6}|={6})\n/)
            const issues: IIssueFile[] = []

            for (const raw of rawIssues) {
                // Skip empty or whitespace-only segments
                if (!raw || !raw.trim()) continue

                // Extract title
                const titleMatch = raw.match(/title: (.+)/)
                if (!titleMatch) continue

                // Remove all blank lines between frontmatter blocks (---\n[blank lines]\n---)
                let cleaned = raw.replace(
                    /^---\n([\s\S]*?)\n---/m,
                    (_, content: string) => {
                        const trimmed = content
                            .split('\n')
                            .filter(line => line.trim() !== '' || line.includes(':'))
                            .join('\n')

                        return `---\n${trimmed}\n---`
                    }
                )

                // Convert labels: ['a', 'b', 'c'] to labels: a,b,c (preserve spaces within multiword labels)
                cleaned = cleaned.replace(/labels:\s*\[(.*?)\]/g, (match, p1: string) => {
                    // Split on comma, trim only leading/trailing spaces for each label, preserve inner spaces
                    const labels = p1.split(',').map(s => s.replace(/['"]/g, '').trim()).filter(Boolean).join(',')

                    return `labels: ${labels}`
                })

                const filepath = path.relative(process.cwd(), filePath)
                const filename = path.basename(filePath)

                issues.push(this.prepareIssue(cleaned.trimStart() + '\n', filepath, filename))
            }

            return issues
        } catch (error: any) {
            this.command.error(`ERROR: Failed to read markdown file: ${error.message}`)

            return []
        }
    }

    /**
     * Validate GitHub token and repository access
     * 
     * @param owner 
     * @param repo 
     * @returns 
     */
    async validateAccess (owner: string, repo: string) {
        const spinner = this.command.spinner('Checking GitHub access...').start()
        try {
            const result = await useOctokit().repos.get({ owner, repo })
            spinner.succeed('GitHub access validated successfully.')

            return result
        } catch (error: any) {
            spinner.stop()
            let message: string = ''

            spinner.fail(`GitHub access validation failed: ${error.message}.`)

            if (error.status === 404) {
                message =
                    'This usually means:\n' +
                    '  1. No internet connection\n' +
                    '  2. DNS server issues\n' +
                    '  3. Firewall/proxy blocking DNS\n' +
                    '  4. The repository does not exist\n' +
                    '  5. You do not have access to the repository\n\n' +
                    'Troubleshooting:\n' +
                    '  - Check your internet connection\n' +
                    '  - Try opening https://github.com in your browser\n' +
                    '  - If behind a corporate firewall, check proxy settings\n' +
                    '  - Try using a different DNS (e.g., 8.8.8.8)\n' +
                    '  - Verify the repository name and owner are correct\n'
            }
            throw new Error(message)
        }
    }

    /**
     * Check network connectivity to GitHub
     */
    async checkConnectivity () {
        const spinner = this.command.spinner('Checking network connectivity...').start()

        try {
            const addresses = await dns.resolve('api.github.com')
            spinner.succeed(`DNS resolution successful: ${Logger.log(addresses[0], 'blue', !1)}`)

            return addresses
        } catch (error: any) {
            spinner.stop()
            throw new Error(
                'ERROR: Cannot resolve api.github.com\n\n' +
                'This usually means:\n' +
                '  1. No internet connection\n' +
                '  2. DNS server issues\n' +
                '  3. Firewall/proxy blocking DNS\n\n' +
                'Troubleshooting:\n' +
                '  - Check your internet connection\n' +
                '  - Try opening https://github.com in your browser\n' +
                '  - If behind a corporate firewall, check proxy settings\n' +
                '  - Try using a different DNS (e.g., 8.8.8.8)\n\n' +
                `Original error: ${error.message}`
            )
        }
    }

    /**
     * Fetch all open issues from the repository
     * 
     * @param owner 
     * @param repo 
     * @param state 
     * @returns 
     */
    async fetchExistingIssues (owner: string, repo: string, state?: 'open' | 'closed' | 'all'): Promise<IIssue[]> {
        const issues: IIssue[] = []
        let page = 1
        let hasMore = true

        const spinner = this.command.spinner('Fetching existing open issues...').start()

        while (hasMore) {
            try {
                const { data } = await useOctokit().issues.listForRepo({
                    owner,
                    repo,
                    state: state || 'open',
                    per_page: 100,
                    page: page,
                })

                issues.push(...data.filter(issue => !issue.pull_request))
                spinner.stop()

                hasMore = issues.length % 100 === 0 && data.length === 100

                if (hasMore) {
                    page++
                } else {
                    hasMore = false
                }
            } catch (error: any) {
                hasMore = false
                spinner.stop()
                this.command.warn(`ERROR: Failed to fetch existing issues: ${error.message}`)
                this.command.warn('INFO: Proceeding without duplicate check...')
            }

        }

        spinner.succeed(`Found ${issues.length} existing issues.`)

        return issues
    }

    /**
     * Handle GitHub API request errors
     * 
     * @param error 
     * @param owner 
     * @param repo 
     * @returns 
     */
    private requestError (error: Error & { status?: number }, owner?: string, repo?: string) {
        // Add specific help for common errors
        let errorMsg = error.message || 'GitHub API error'

        if (error.status === 401) {
            errorMsg += '\n\nThis is an authentication error. Check that:'
            errorMsg += `\n  1. You are logged in (make sure to run the ${Logger.log('login', ['grey', 'italic'], !1)}`
            errorMsg += 'command first)'
            errorMsg += '\n  2. The app token has "repo" scope'
            errorMsg += '\n  3. The app token hasn\'t expired'
        } else if (error.status === 404) {
            errorMsg += '\n\nRepository not found. Check that:'
            if (owner)
                errorMsg += `\n  1. ${Logger.log(owner, ['blue', 'bold'], !1)} is a valid gitHub username or organization`
            if (repo)
                errorMsg += `\n  2. ${Logger.log(repo, ['blue', 'bold'], !1)} is the correct repository name`
            errorMsg += '\n  3. You have access to this repository'
        } else if (error.status === 422) {
            errorMsg += '\n\nValidation failed. This usually means:'
            errorMsg += '\n  1. Issue data format is invalid'
            errorMsg += '\n  2. Labels don\'t exist in the repository'
            errorMsg += '\n  3. Assignees don\'t have access to the repository'
        }

        return new Error(errorMsg)
    }
} 
