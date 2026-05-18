import { read, write } from './db'

import { Command } from '@h3ravel/musket'
import { IConfig } from './Contracts/Interfaces'
import { Octokit } from '@octokit/rest'
import { getGitCredentialForCurrentRepo } from './github/repo-detect'

let commandInstance: Command | undefined

/**
 * Hook to get or set the current Command instance.
 */
export function useCommand () {
    return [
        () => {
            if (!commandInstance) {
                throw new Error('Commander instance has not been initialized')
            }

            return commandInstance
        },
        (newCommand: Command) => {
            commandInstance = newCommand
        },
    ] as const
}

/**
 * Hook to get or set the application configuration.
 * 
 * @returns 
 */
export function useConfig () {
    return [
        (): IConfig => {
            return read('config') || {
                debug: false,
                apiBaseURL: 'https://api.github.com',
                timeoutDuration: 3000,
                useCurrentRepo: true,
                ngrokAuthToken: undefined,
                skipLongCommandGeneration: true,
            }
        },
        (config: IConfig): IConfig => {
            write('config', config)

            return read('config')
        },
    ] as const
}


const shortcutUsed = new Set<string>()

/**
 * Hook to make command shortcuts unique across the application.
 * 
 * @returns 
 */
export function useShortcuts () {
    return [
        () => Array.from(shortcutUsed).filter(s => !!s),
        (shortcut?: string): boolean => {
            if (!shortcut) {
                shortcutUsed.clear()

                return false
            }
            if (shortcutUsed.has(shortcut)) {
                return false
            }
            shortcutUsed.add(shortcut)

            return true
        },
    ] as const
}

/**
 * Hook to get an authenticated Octokit instance.
 * 
 * @returns 
 */
export const useOctokit = () => {
    let token: string | undefined
    const [getConfig] = useConfig()
    const config = getConfig()

    if (config.useCurrentRepo === true) {
        const credential = getGitCredentialForCurrentRepo()
        if (credential && credential.password) {
            token = credential.password
        }
    }

    if (!token) {
        token = read<string>('token')
    }

    if (!token) {
        throw new Error('No authentication token found. Please log in first.')
    }

    return new Octokit({
        auth: token,
    })
}