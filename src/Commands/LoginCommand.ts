import * as db from 'src/db'

import { signIn, storeLoginDetails } from 'src/Github'
import { useCommand, useOctokit } from 'src/hooks'

import { Command } from '@h3ravel/musket'
import { IUser } from 'src/Contracts/Interfaces'
import { Logger } from '@h3ravel/shared'
import { promiseWrapper } from 'src/helpers'

export class LoginCommand extends Command {
    protected signature = 'login'
    protected description = 'Log in to Ghit'

    async handle () {
        const [_, setCommand] = useCommand()
        setCommand(this)
        let token = db.read('token'), user: IUser | undefined

        if (token) {
            return void this.info('INFO: You\'re already logged in').newLine()
        } else {
            const [_, response] = await promiseWrapper(
                signIn(),
            )

            if (response) {
                storeLoginDetails(response)
                token = db.read('token')
                user = db.read<IUser>('user')
            }
        }

        if (token && user) {
            const repos = await useOctokit('user').rest.repos.listForAuthenticatedUser()

            const repoName = await this.choice('Select default repository', repos.data.map(r => ({
                name: r.full_name,
                value: r.full_name,
            })), 0)

            const repo = repos.data.find(r => r.full_name === repoName)

            if (repo) {
                db.write('default_repo', {
                    id: repo.id,
                    name: repo.name,
                    full_name: repo.full_name,
                    private: repo.private,
                })
            } else {
                db.write('default_repo', {})
            }

            this.info(`INFO: You have been logged in as ${Logger.log(user.name, 'blue', !1)}!`).newLine()
        }

        process.exit(0)
    }
} 