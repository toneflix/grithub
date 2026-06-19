import { configChoices, saveConfig } from '../utils/config'
import { useCommand, useConfig } from '../hooks'

import { Command } from '@h3ravel/musket'

export class ConfigCommand extends Command {
    protected signature = 'config'
    protected description = 'Configure Ghit'

    async handle () {
        const [_, setCommand] = useCommand()
        setCommand(this)
        const [getConfig, setConfig] = useConfig()
        let config = getConfig()

        if (!config) {
            config = {
                debug: false,
                apiBaseURL: 'https://api.github.com',
                timeoutDuration: 3000,
                useCurrentRepo: true,
                ngrokAuthToken: undefined,
                skipLongCommandGeneration: true,
                reuseSshCredential: true,
            }
            setConfig(config)
        }

        const choice = await this.choice(
            'Select configuration to set',
            configChoices(config)
        )

        await saveConfig(choice as keyof typeof config)

        this.info('Configuration updated successfully!').newLine()
    }
}