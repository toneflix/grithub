import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { hookState, mockCommand } = vi.hoisted(() => {
    const hookState = {
        issuesPathArg: 'issues',
    }

    const mockCommand = {
        spinner: vi.fn(() => {
            const spinner = {
                start: vi.fn(() => spinner),
                succeed: vi.fn(() => spinner),
                info: vi.fn(() => spinner),
                stop: vi.fn(() => spinner),
                fail: vi.fn(() => spinner),
            }

            return spinner
        }),
        argument: vi.fn((name: string, fallback?: string) => {
            if (name === 'path') {
                return hookState.issuesPathArg
            }

            return fallback
        }),
        error: vi.fn(),
    }

    return { hookState, mockCommand }
})

vi.mock('src/hooks', () => ({
    useCommand: () => [() => mockCommand],
    useOctokit: vi.fn(),
}))

import { IssuesSeeder } from '../src/github/issues-seeder'

describe('IssuesSeeder filesystem behavior', () => {
    let tempDir = ''

    beforeEach(() => {
        tempDir = mkdtempSync(path.join(tmpdir(), 'ghit-seeder-'))
        hookState.issuesPathArg = 'issues'
    })

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true })
    })

    it('normalizes Windows separators in filepath metadata', () => {
        const seeder = new IssuesSeeder()
        const withPath = seeder.setFilePath('Body', 'wave-1\\001-issue.md')

        expect(withPath).toContain('<!-- ghit#filepath: wave-1/001-issue.md -->')
        expect(seeder.getFilePath(withPath)).toBe('wave-1/001-issue.md')
    })

    it('normalizes prepared issue file paths for cross-platform matching', () => {
        const seeder = new IssuesSeeder()
        const issue = seeder.prepareIssue('---\ntitle: Test\n---\nBody', 'demo\\wave-1\\001-issue.md', '001-issue')

        expect(issue.filePath).toBe('demo/wave-1/001-issue.md')
    })

    it('processIssueFile stores path relative to configured issues directory', () => {
        const seeder = new IssuesSeeder()
        const issuesRoot = path.join(tempDir, 'issues')
        const nested = path.join(issuesRoot, 'demo')
        const issueFile = path.join(nested, '001-alpha.md')

        mkdirSync(nested, { recursive: true })
        writeFileSync(issueFile, '---\ntitle: Alpha\n---\nBody', 'utf8')

        hookState.issuesPathArg = path.relative(process.cwd(), issuesRoot)

        const issue = seeder.processIssueFile(issueFile)
        expect(issue.filePath).toBe('demo/001-alpha.md')
    })

    it('processMultiIssueMarkdown uses normalized relative source filepath metadata', () => {
        const seeder = new IssuesSeeder()
        const issueFile = path.join(tempDir, 'bulk', 'seed.md')

        mkdirSync(path.dirname(issueFile), { recursive: true })
        writeFileSync(issueFile, [
            '---',
            'title: One',
            'labels: ["bug", "help wanted"]',
            '---',
            'Body one',
            '======',
            '---',
            'title: Two',
            '---',
            'Body two',
        ].join('\n'), 'utf8')

        const issues = seeder.processMultiIssueMarkdown(issueFile)
        const expectedPath = path.relative(process.cwd(), issueFile).split(path.sep).join('/')

        expect(issues).toHaveLength(2)
        expect(issues[0]?.filePath).toBe(expectedPath)
        expect(issues[1]?.filePath).toBe(expectedPath)
        expect(issues[0]?.labels).toEqual(['bug', 'help wanted'])
    })

    it('getIssueFiles reads markdown files recursively and returns sorted paths', () => {
        const seeder = new IssuesSeeder()
        const root = path.join(tempDir, 'all-issues')

        mkdirSync(path.join(root, 'zeta'), { recursive: true })
        mkdirSync(path.join(root, 'alpha'), { recursive: true })

        writeFileSync(path.join(root, 'zeta', '02-zeta.md'), 'zeta', 'utf8')
        writeFileSync(path.join(root, 'alpha', '01-alpha.md'), 'alpha', 'utf8')
        writeFileSync(path.join(root, '03-gamma.md'), 'gamma', 'utf8')
        writeFileSync(path.join(root, 'README.txt'), 'skip', 'utf8')

        const result = seeder.getIssueFiles(root)

        expect(result).toHaveLength(3)
        expect(result).toEqual([...result].sort())
        expect(result.every(file => file.endsWith('.md'))).toBe(true)
    })
})
