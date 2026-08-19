import { deleteIssue, listIssues } from 'src/github/actions'

import { Command } from '@h3ravel/musket'
import { IRepoEntry } from 'src/Contracts/Interfaces'
import { read } from 'src/db'
import { useCommand } from 'src/hooks'

export class IssuesDeleteCommand extends Command {
    protected signature = `issues:delete
        { repo? : The full name of the repository (e.g., username/repo)}
        {--dry-run : Simulate the deletion without actually deleting issues.}
    `
    protected description = 'Delete issues from the specified repository.'

    async handle () {
        const [_, setCommand] = useCommand()
        setCommand(this)

        const repo = read<IRepoEntry>('default_repo')
        const repository = (this.argument('repo', repo.full_name).split('/') ?? ['', '']) as [string, string]
        const spinner = this.spinner('Fetching issues...').start()
        const isDryRun = this.option('dryRun', false)

        try {
            const issues = await this.loadIssues(repository)
            spinner.succeed(`${issues.length} issues fetched successfully.`)

            if (issues.length < 1) {
                return void this.info('No issues found in this repository.')
            }

            const choices = await this.checkbox(`Select Issue${isDryRun ? ' (Dry Run)' : ''}`, issues.map(issue => ({
                name: `#${issue.number}: ${issue.state === 'open' ? '🟢' : '🔴'} ${issue.title}`,
                value: String(issue.number),
            })), true, undefined, 20)

            const confirm = await this.confirm(
                `Are you sure you want to delete the selected ${choices.length} issue(s)? ${isDryRun ? '(Dry Run - No changes will be made)' : 'This action cannot be undone'}.`
            )

            if (!confirm) {
                return void this.info('Operation cancelled.')
            }

            for (const issue of issues.filter(issue => choices.includes(String(issue.number)))) {
                spinner.start(`Deleting issue #${issue.number}...`)
                if (!isDryRun) {
                    await deleteIssue(repository[0], repository[1], issue.number, issue.node_id)
                    spinner.succeed(`Issue #${issue.number} deleted successfully.`)
                } else {
                    spinner.info(`Dry run: Issue #${issue.number} would be deleted.`)
                }
            }

            this.success(`${choices.length} issue(s) deleted successfully.`)
        } catch (error: any) {
            spinner.stop()

            return void this.error(error.message)
        }
    }

    async loadIssues (repository: [string, string]) {
        const { issues } = await listIssues(repository[0], repository[1], { state: 'all' })

        return issues
    }
}