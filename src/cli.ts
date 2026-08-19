#!/usr/bin/env node

import './utils/global'

import { Application } from './Application'
import Commands from './Commands/Commands'
import { ConfigCommand } from './Commands/ConfigCommand'
import { GenerateApisCommand } from './Commands/GenerateApisCommand'
import { InfoCommand } from './Commands/InfoCommand'
import { InitCommand } from './Commands/InitCommand'
import { IssuesCloneCommand } from './Commands/IssuesCloneCommand'
import { IssuesCommand } from './Commands/IssuesCommand'
import { IssuesDeleteCommand } from './Commands/IssuesDeleteCommand'
import { IssuesDownloadCommand } from './Commands/IssuesDownloadCommand'
import { IssuesSeedCommand } from './Commands/IssuesSeedCommand'
import { IssuesUpdateCommand } from './Commands/IssuesUpdateCommand'
import { Kernel } from '@h3ravel/musket'
import { LoginCommand } from './Commands/LoginCommand'
import { LogoutCommand } from './Commands/LogoutCommand'
import { SetRepoCommand } from './Commands/SetRepoCommand'
import { initAxios } from './axios'
import logo from './logo'
import { useConfig } from './hooks'
import { version } from '../package.json'

initAxios()
Kernel.init(new Application(), {
    logo,
    version,
    exceptionHandler(exception) {
        const [getConfig] = useConfig()
        const config = getConfig()

        console.error(config.debug ? exception : exception.message)
    },
    baseCommands: [
        InfoCommand,
        InitCommand,
        LoginCommand,
        LogoutCommand,
        ConfigCommand,
        IssuesCommand,
        SetRepoCommand,
        IssuesSeedCommand,
        IssuesCloneCommand,
        IssuesUpdateCommand,
        IssuesDeleteCommand,
        GenerateApisCommand,
        IssuesDownloadCommand,
        ...Commands(),
    ],
})