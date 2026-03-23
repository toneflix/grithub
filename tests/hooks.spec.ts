import { Command, Kernel } from '@h3ravel/musket'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { init, useDb, useDbPath } from '../src/db'
import { mkdtempSync, rmSync } from 'fs'
import { useCommand, useConfig, useShortcuts } from '../src/hooks'

import { afterAll } from 'vitest'
import path from 'path'
import { tmpdir } from 'os'

class App {
    registeredCommands: typeof Command[] = []
}

let app, program: any
const tempDbDir = mkdtempSync(path.join(tmpdir(), 'ghit-hooks-spec-'))
const [getDatabase, setDatabase] = useDb()

beforeAll(async () => {
    const [__, setDbPath] = useDbPath()

    setDbPath(tempDbDir)
    setDatabase('testdb.db')
    init()

    app = new App()
    program = await Kernel.init(
        app,
        {
            packages: ['ghit'],
            skipParsing: true,
            name: 'musket-cli',
            discoveryPaths: [path.join(process.cwd(), 'src/Commands/*.ts')]
        }
    )
})

afterAll(() => {
    getDatabase().close()
    rmSync(tempDbDir, { recursive: true, force: true })
})

describe('Hooks Test', () => {
    beforeEach(() => {
        // Reset command instance before each test
        const [_, setCommand] = useCommand()
        setCommand(undefined as unknown as Command)

        // Reset config before each test
        const [__, setConfig] = useConfig()
        setConfig(undefined as unknown as any)

        // Reset shortcuts before each test
        const [___, clearShortcuts] = useShortcuts()
        clearShortcuts()
    })

    it('useCommand Hook', () => {
        const [getCommand, setCommand] = useCommand()

        const cmdInstance = new Command(new App(), program)
        setCommand(cmdInstance)

        expect(getCommand()).toBe(cmdInstance)
    })

    it('useConfig Hook', () => {
        const [getConfig, setConfig] = useConfig()

        const config = {
            debug: true,
            apiBaseURL: 'https://custom.api',
            timeoutDuration: 5000
        }
        setConfig(config)

        expect(getConfig()).toEqual(config)
    })

    it('useShortcuts Hook', () => {
        const [getShortcuts, addShortcut] = useShortcuts()

        expect(getShortcuts()).toEqual([])

        const added1 = addShortcut('ls')
        expect(added1).toBe(true)
        expect(getShortcuts()).toEqual(['ls'])

        const added2 = addShortcut('ls')
        expect(added2).toBe(false)
        expect(getShortcuts()).toEqual(['ls'])

        const added3 = addShortcut('rm')
        expect(added3).toBe(true)
        expect(getShortcuts()).toEqual(['ls', 'rm'])
    })

    describe('useOctokit Hook', () => {
        it('should initialize Octokit instance with default config', async () => {
            const { Octokit } = await import('@octokit/rest')
            const [getConfig] = useConfig()
            const config = getConfig()

            const octokitInstance = new Octokit({
                baseUrl: config.apiBaseURL,
                request: {
                    timeout: config.timeoutDuration,
                },
            })

            expect(octokitInstance).toBeInstanceOf(Octokit)
            expect(octokitInstance.request.endpoint.DEFAULTS.baseUrl).toBe(config.apiBaseURL)
        })

        it('should initialize Octokit instance with custom config', async () => {
            const { Octokit } = await import('@octokit/rest')
            const [_, setConfig] = useConfig()

            const customConfig = {
                debug: false,
                apiBaseURL: 'https://custom.api',
                timeoutDuration: 10000
            }
            setConfig(customConfig)

            const octokitInstance = new Octokit({
                baseUrl: customConfig.apiBaseURL,
                request: {
                    timeout: customConfig.timeoutDuration,
                },
            })

            expect(octokitInstance).toBeInstanceOf(Octokit)
            expect(octokitInstance.request.endpoint.DEFAULTS.baseUrl).toBe(customConfig.apiBaseURL)
        })
    })
})