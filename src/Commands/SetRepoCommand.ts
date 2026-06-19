import { read, write } from 'src/db'
import { useCommand, useOctokit } from 'src/hooks'

import { Command } from '@h3ravel/musket'
import { Logger } from '@h3ravel/shared'
import { extractRepoInfo } from 'src/helpers'

export class SetRepoCommand extends Command {
    protected signature = `set-repo 
        { name? : The full name of the repository (e.g., username/repo)}
        {--O|org? : Set repository from an organization}
    `
    protected description = 'Set the default repository.'

    async handle () {
        const [_, setCommand] = useCommand()
        setCommand(this)
        const token = read('token')
        let repo: any = undefined

        if (!token)
            return void this.error('ERROR: You must be logged in to set a default repository.')

        if (this.argument('name')) {
            const [ownerName, repoName] = extractRepoInfo(this.argument('name'));
            ({ data: repo } = await useOctokit('user').rest.repos.get({
                owner: ownerName,
                repo: repoName,
            }))
        } else {

            if (this.option('org')) {
                const spinner = this.spinner('Fetching your organizations...').start()
                const orgs = await useOctokit('user').rest.orgs.listForAuthenticatedUser()
                spinner.succeed(`${orgs.data.length} organizations fetched successfully.`)

                const orgName = await this.choice('Select organization', orgs.data.map(o => ({
                    name: o.login,
                    value: o.login,
                })), 0)

                const orgReposSpinner = this.spinner(`Fetching repositories for organization ${orgName}...`).start()
                const repos = await useOctokit('user').rest.repos.listForOrg({
                    org: orgName,
                })
                orgReposSpinner.succeed(`${repos.data.length} repositories fetched successfully.`)

                const repoName = await this.choice(
                    `Select default repository (${read('default_repo')?.full_name ?? 'none'})`,
                    repos.data.map(r => ({
                        name: r.full_name,
                        value: r.full_name,
                    })), 0)

                repo = repos.data.find(r => r.full_name === repoName)
            } else {
                const spinner = this.spinner('Fetching your repositories...').start()

                const repos = await useOctokit('user').rest.repos.listForAuthenticatedUser()
                spinner.succeed(`${repos.data.length} repositories fetched successfully.`)

                const repoName = await this.choice(
                    `Select default repository (${read('default_repo')?.full_name ?? 'none'})`,
                    repos.data.map(r => ({
                        name: r.full_name,
                        value: r.full_name,
                    })), 0)

                repo = repos.data.find(r => r.full_name === repoName)
            }
        }

        if (repo) {
            write('default_repo', {
                id: repo.id,
                name: repo.name,
                full_name: repo.full_name,
                private: repo.private,
                ssh_url: repo.ssh_url,
                clone_url: repo.clone_url,
            })
            this.info(`INFO: ${Logger.log(repo.full_name, 'blue', !1)} has been set as the default repository.`).newLine()
        } else {
            write('default_repo', read('default_repo') ?? {})
            this.warn('INFO: No repository selected. Default repository has been cleared.').newLine()
        }
    }
}