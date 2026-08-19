import { mkdirSync, writeFileSync } from 'node:fs'
import { useCommand } from 'src/hooks'

import { Command } from '@h3ravel/musket'
import { Logger } from '@h3ravel/shared'
import { extractRepoInfo } from 'src/helpers'
import { listIssues } from 'src/github/actions'
import path from 'node:path'

export class IssuesDownloadCommand extends Command {
    protected signature = `issues:download
        {from : The repository to download issues from.}
        {target? : The directory to download issues into, relative to current directory. If not provided, a directory named after the repository will be created in the current working directory.}
        {--f|labeled? : Comma-separated list of labels to filter issues by. Only issues with at least one of these labels will be downloaded.}
        {--dry-run : Simulate the deletion without actually deleting issues.}
    `
    protected description = 'Download issues from a specified repository.'
    async handle () {
        const [_, setCommand] = useCommand()
        setCommand(this)

        const spinner = this.spinner('Fetching issues...').start()
        const isDryRun = this.option('dryRun', false)
        const [owner, repo] = extractRepoInfo(this.argument('from'))
        const target = this.argument('target', `issues/${owner}-${repo}`)

        if (!repo || !owner) {
            return void this.error('The "from" repository is required.')
        }

        const { issues } = await listIssues(owner, repo, {
            state: 'open',
            labels: this.option('labeled') ? this.option('labeled').split(',').map((l: string) => l.trim()) : undefined,
        })

        if (issues.length < 1)
            return void spinner.info('No issues found to clone.')
        spinner.succeed('Issues fetched successfully.')


        if (isDryRun) {
            return void Logger.log([
                ['⚠️ ', 'white'],
                [' DRY RUN ', 'bgYellow'],
                ['This will download', 'yellow'],
                [issues.length.toString(), 'blue'],
                ['issues from', 'yellow'],
                [`${owner}/${repo}`, 'cyan'],
                ['to', 'yellow'],
                [target, 'cyan'],
            ], ' ')
        }

        spinner.start(`Downloading issues from ${owner}/${repo} to ${target}...`)

        mkdirSync(path.resolve(process.cwd(), target), { recursive: true })

        issues.map((i, index) => {
            const content = `---
type: ${i.type?.name ?? 'Feature'}
name: ${i.title}
title: ${i.title}
labels: ${i.labels.map(l => typeof l === 'string' ? l : l.name).join(', ')}
assignees: ${i.assignees?.map(a => a.login).join(', ')}
---

${i.body ?? ''}`

            const fileName = `${index + 1}-${i.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+/, '').replace(/-+$/, '').toLowerCase()}.md`
            const filePath = path.resolve(process.cwd(), `${target}/${fileName}`)

            writeFileSync(filePath, content, { encoding: 'utf-8' })
        })

        spinner.succeed(`Downloaded ${issues.length} issues to ${target}.`)
    }
}