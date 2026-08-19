import { IIssueFile, IRepoEntry } from 'src/Contracts/Interfaces'
import { buildIssueFile, extractRepoInfo, logger, wait } from 'src/helpers'
import { useCommand } from 'src/hooks'

import { Command } from '@h3ravel/musket'
import { IssuesSeeder } from 'src/github/issues-seeder'
import { Logger } from '@h3ravel/shared'
import { listIssues } from 'src/github/actions'
import { read } from 'src/db'

export class IssuesCloneCommand extends Command {
    protected signature = `issues:clone
        {from : The repository to clone issues from.}
        {target? : The repository to clone issues to. If not provided, the default repository will be used.}
        {--f|labeled? : Comma-separated list of labels to filter issues by. Only issues with at least one of these labels will be cloned.}
        {--l|labels? : Comma-separated list of labels to add to cloned issues.}
        {--dry-run : Simulate the cloning without actually cloning issues.}
    `

    protected description = 'Clone issues from a specified repository to the default repository.'

    async handle () {
        const [_, setCommand] = useCommand()
        setCommand(this)

        const spinner = this.spinner('Fetching issues...').start()
        const isDryRun = this.option('dryRun', false)
        const [owner, repo] = extractRepoInfo(this.argument('from'))

        if (!repo || !owner) {
            return void this.error('The "from" repository is required.')
        }

        const { issues } = await listIssues(owner, repo, {
            state: 'open',
            sort: 'created',
            direction: 'asc',
            labels: this.option('labeled')
                ? this.option('labeled').split(',').map((l: string) => l.trim())
                : undefined,
        })

        if (issues.length < 1) {
            return void spinner.info('No issues found to clone.')
        }

        spinner.succeed('Issues fetched successfully.')

        let target: [string, string] | undefined = undefined
        const toCreate: IIssueFile[] = []

        const defRep = read<IRepoEntry>('default_repo')
        if (defRep?.full_name && !this.argument('target'))
            target = extractRepoInfo(defRep.full_name)
        else if (this.argument('target'))
            target = extractRepoInfo(this.argument('target'))

        if (!target) {
            return void this.error('The "target" repository is required (you can set a default repository using the set-repo command to skip this requirement).')
        }

        const seeder = new IssuesSeeder()

        await seeder.validateAccess(...target)
        const existingIssues = await seeder.fetchExistingIssues(...target, 'all')
        const existingNames = new Set(existingIssues.map(i => i.title))

        if (existingIssues.length > 0) {
            this.newLine().info('INFO: Issues to SKIP (already exist):')
            issues.forEach((issue) => {
                if (existingNames.has(issue.title)) {
                    logger(`  >  ${issue.title}`, 'white', !0)
                    logger(`     Existing: #${issue.number} (${issue.state})`, 'white', !0)
                } else {
                    toCreate.push(buildIssueFile(issue))
                }
            })
        } else {
            toCreate.push(...issues.map(i => buildIssueFile(i)))
        }

        if (toCreate.length < 1) {
            return void this.info('No new issues to clone.')
        }

        Logger.log([
            ['⚠️ ', 'white'],
            [' CONFIRM ', 'bgYellow'],
            ['This will clone', 'yellow'],
            [toCreate.length.toString(), 'blue'],
            ['new issues from', 'yellow'],
            [`${owner}/${repo}`, 'cyan'],
            ['to', 'yellow'],
            [`${target[0]}/${target[1]}.`, 'cyan'],
        ], ' ')

        if (existingIssues.length > 0) {
            this.info(`(Skipping ${existingIssues.length} existing issues)`)
        }

        const proceed = await this.confirm(`Do you want to proceed?${isDryRun ? ' (Dry Run - No changes will be made)' : ''}`)

        if (!proceed)
            return void this.info('Operation cancelled by user.')

        spinner.start(
            `Cloning issues from ${owner}/${repo} to ${target[0]}/${target[1]}...`
        )

        let created = 0
        let failed = 0
        for (const issue of toCreate) {
            if (this.option('labels')) {
                const al = this.option('labels').split(',').map((l: string) => l.trim())
                issue.labels.push(...al)
            }

            try {
                spinner.start(`Creating: ${issue.title}...`)
                if (!isDryRun) {
                    const result = await seeder.createIssue(issue, ...target)
                    spinner.succeed(`Created #${result.number}: ${result.title}`)
                    this.info(`URL: ${result.html_url}\n`)
                } else {
                    spinner.info(`Dry run: Issue ${logger(issue.title, ['cyan', 'italic'])} would be cloned.`)
                }
                created++

                // Rate limiting: wait 1 second between requests
                await wait(1000)
            } catch (error: any) {
                this.error(`ERROR: Failed to clone issue: ${logger(issue.title, ['cyan', 'italic'])}`)
                this.error(`ERROR: ${error.message}\n`)
                failed++
            }
        }

        Logger.log([
            ['=========================', 'white'],
            [`✔ Created: ${created}`, 'white'],
            [`> Skipped: ${existingIssues.length}`, 'white'],
            [`x Failed: ${failed}`, 'white'],
            [`☑ Total: ${issues.length}`, 'white'],
            ['========================', 'white'],
        ], '\n')
        spinner.succeed(`All ${issues.length} issues cloned.`)
    }
}