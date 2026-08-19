import { IIssue, IRepoEntry } from 'src/Contracts/Interfaces'
import { logger, viewIssue } from 'src/helpers'
import { useCommand, useOctokit } from 'src/hooks'

import { Command } from '@h3ravel/musket'
import { IssuesSeeder } from 'src/github/issues-seeder'
import { deleteIssue, listIssues } from 'src/github/actions'
import { read } from 'src/db'

export class IssuesCommand extends Command {
    protected signature = `issues
        { repo? : The full name of the repository (e.g., username/repo)}
    `

    protected description = 'Manage issues in the default repository.'

    async handle () {
        const [_, setCommand] = useCommand()
        setCommand(this)

        const repo = read<IRepoEntry>('default_repo')
        const repository = (this.argument('repo', repo.full_name).split('/') ?? ['', '']) as [string, string]
        const spinner = this.spinner('Fetching issues...').start()

        try {
            let page: number | null = 1
            const issues: IIssue[] = []

            do {
                const { issues: newIssues, nextPage } = await this.loadIssues(repository, page)
                issues.push(...newIssues)
                page = nextPage
                spinner.succeed(`${issues.length} issues fetched successfully.`)

                if (issues.length < 1) {
                    return void this.info('No issues found in this repository.').newLine()
                }

                const choice = await this.choice('Select Issue', issues.map(issue => ({
                    name: `#${issue.number}: ${issue.state === 'open' ? '🟢' : '🔴'} ${issue.title}`,
                    value: String(issue.number),
                })).concat(page ? [{
                    name: 'Load more issues',
                    value: '>>',
                }] : []), 0)

                if (choice !== '>>') {
                    const issue = issues.find(issue => String(issue.number) === choice)!
                    this.info(`#${issue.number}: ${issue.title}`).newLine()

                    const action = await this.choice('Choose Action', [
                        { name: 'View Details', value: 'view' },
                        !issue.closed_at ? { name: 'Close Issue', value: 'close' } : null,
                        issue.closed_at ? { name: 'Reopen Issue', value: 'reopen' } : null,
                        { name: 'Edit Issue', value: 'edit' },
                        { name: logger('Delete Issue', ['red', 'italic']), value: 'delete' },
                        { name: 'Exit', value: 'exit' },
                    ].filter(e => !!e), 0)

                    if (action === 'view') {
                        viewIssue(issue)
                        this.newLine()
                    } else if (action === 'close') {
                        if (issue.state === 'closed') {
                            this.warn('Issue is already closed.').newLine()
                        } else {
                            spinner.start(`Closing issue #${issue.number}...`)
                            await useOctokit().issues.update({
                                owner: repository[0],
                                repo: repository[1],
                                issue_number: issue.number,
                                state: 'closed',
                            })
                            spinner.succeed(`Issue #${issue.number} closed successfully.`)
                        }
                    } else if (action === 'reopen') {
                        if (issue.state === 'open') {
                            this.warn('Issue is already open.').newLine()
                        } else {
                            spinner.start(`Reopening issue #${issue.number}...`)
                            await useOctokit().issues.update({
                                owner: repository[0],
                                repo: repository[1],
                                issue_number: issue.number,
                                state: 'open',
                            })
                            spinner.succeed(`Issue #${issue.number} reopened successfully.`)
                        }
                    } else if (action === 'edit') {
                        const whatToEdit = await this.choice('What do you want to edit?', [
                            { name: 'Title', value: 'title' },
                            { name: 'Body', value: 'body' },
                        ], 0)

                        if (whatToEdit === 'exit') {
                            return
                        }

                        const updates: Record<string, any> = {}

                        if (whatToEdit === 'title') {
                            const newTitle = await this.ask('Enter new title:', issue.title)
                            updates.title = newTitle
                        } else if (whatToEdit === 'body') {
                            const newBody = await this.editor('Edit issue body:', '.md', issue.body ?? '')
                            updates.body = newBody
                        }

                        if (Object.keys(updates).length > 0) {
                            const seeder = new IssuesSeeder()

                            spinner.start(`Updating issue #${issue.number}...`)
                            await seeder.updateIssue(
                                Object.assign({ labels: issue.labels, assignees: issue.assignees }, updates) as never,
                                issue,
                                ...repository
                            )

                            spinner.succeed(`Issue #${issue.number} updated successfully.`)
                        } else {
                            this.info('No changes made to the issue.').newLine()
                        }
                    } else if (action === 'delete') {
                        spinner.start(`Deleting issue #${issue.number}...`)
                        await deleteIssue(repository[0], repository[1], issue.number, issue.node_id)
                        spinner.succeed(`Issue #${issue.number} deleted successfully.`)
                    } else if (action === 'exit') {
                        return
                    }

                    return
                }

                spinner.start('Fetching issues...')
            } while (page)
        } catch (error: any) {
            spinner.stop()

            return void this.error(error.message)
        }
    }

    async loadIssues (repository: [string, string], page: number = 1) {
        return await listIssues(repository[0], repository[1], {
            page,
            state: 'all',
            limit: 20,
            perPage: 20,
        })
    }
}