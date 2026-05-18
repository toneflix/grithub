import { useCommand, useConfig } from '../hooks'

import { IConfig } from '../Contracts/Interfaces'
import { logger } from 'src/helpers'

export const configChoices = (config: IConfig) => {
    return [
        {
            name: 'Debug Mode',
            value: 'debug',
            description: `Enable or disable debug mode (${config.debug ? 'Enabled' : 'Disabled'})`
        },
        {
            name: 'API Base URL',
            value: 'apiBaseURL',
            description: `Set the base URL for the API (${config.apiBaseURL})`
        },
        {
            name: 'Timeout Duration',
            value: 'timeoutDuration',
            description: `Set the timeout duration for API requests (${config.timeoutDuration} ms)`
        },
        {
            name: 'Use Current Repo for Commands',
            value: 'useCurrentRepo',
            description: `Enable or disable automatic detection of the current git repository for commands that support it (${config.useCurrentRepo === true ? 'Enabled' : (config.useCurrentRepo === 'repo' ? 'Repo Only' : 'Disabled')})`
        },
        {
            name: 'Skip Long Command Generation',
            value: 'skipLongCommandGeneration',
            description: `Enable or disable skipping of long command generation when calling ${logger('generate:apis', ['grey', 'italic'])} (${config.skipLongCommandGeneration ? 'Enabled' : 'Disabled'})`
        },
        {
            name: 'Ngrok Auth Token',
            value: 'ngrokAuthToken',
            description: `Set the Ngrok Auth Token - will default to environment variable if not set (${config.ngrokAuthToken ? '************' : 'Not Set'})`
        },
        {
            name: 'Reset Configuration',
            value: 'reset',
            description: 'Reset all configurations to default values'
        },
    ]
}

export const saveConfig = async (choice: keyof IConfig) => {
    const [getConfig, setConfig] = useConfig()
    const [command] = useCommand()
    let config = getConfig()

    if (choice === 'debug') {
        const debug = await command()
            .choice(
                `Enable debug mode? (${config.debug ? 'Enabled' : 'Disabled'})`, [
                { name: 'Enable', value: '1' },
                { name: 'Disable', value: '0' }
            ], config.debug ? 0 : 1)
        config.debug = debug === '1'
    } else if (choice === 'apiBaseURL') {
        const apiBaseURL = await command().ask('Enter API Base URL', config.apiBaseURL)
        config.apiBaseURL = apiBaseURL
    } else if (choice === 'ngrokAuthToken') {
        const ngrokAuthToken = await command().ask('Enter Ngrok Auth Token', config.ngrokAuthToken || '')
        config.ngrokAuthToken = ngrokAuthToken
    } else if (choice === 'timeoutDuration') {
        const timeoutDuration = await command().ask('Enter Timeout Duration (in ms)', config.timeoutDuration.toString())
        config.timeoutDuration = parseInt(timeoutDuration)
    } else if (choice === 'useCurrentRepo') {
        const useCurrentRepo = await command()
            .choice(
                `Enable automatic detection of the current git repository for commands that support it? (${config.useCurrentRepo === true ? 'Enabled' : (config.useCurrentRepo === 'repo' ? 'Repo Only' : 'Disabled')})`, [
                { name: 'Enable', value: '1' },
                { name: 'Repo Only', value: 'repo' },
                { name: 'Disable', value: '0' }
            ], config.useCurrentRepo === true ? 0 : (config.useCurrentRepo === 'repo' ? 1 : 2))
        config.useCurrentRepo = useCurrentRepo === 'repo' ? 'repo' : useCurrentRepo === '1'
    } else if (choice === 'skipLongCommandGeneration') {
        const skipLongCommandGeneration = await command()
            .choice(
                `Enable skipping of long command generation? (${config.skipLongCommandGeneration ? 'Enabled' : 'Disabled'})`, [
                { name: 'Enable', value: '1' },
                { name: 'Disable', value: '0' }
            ], config.skipLongCommandGeneration ? 0 : 1)
        config.skipLongCommandGeneration = skipLongCommandGeneration === '1'
    } else if (choice === 'reset') {
        config = {
            debug: false,
            apiBaseURL: 'https://api.github.com',
            timeoutDuration: 3000,
            useCurrentRepo: true,
            ngrokAuthToken: undefined,
            skipLongCommandGeneration: true,
        }
    }

    setConfig(config)
}