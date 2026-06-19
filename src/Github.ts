import * as db from './db'

import { ILogin, IUser } from './Contracts/Interfaces.js'
import { createDeviceCode, exchangeDeviceCode } from '@octokit/oauth-methods'
import open, { apps } from 'open'
import { wait, waitForEnter } from './helpers'

import { Logger } from '@h3ravel/shared'
import { Octokit } from '@octokit/rest'
import { config } from './config'
import { type as os } from 'os'
import { useCommand } from './hooks'

/**
 * Sign in user
 * 
 * @returns
 */
export async function signIn () {
  const [cmd] = useCommand()
  const command = cmd()

  let spinner = command.spinner('Requesting device code...').start()

  try {
    const {
      data: { device_code, user_code, verification_uri, interval },
    } = await createDeviceCode({
      clientType: config.CLIENT_TYPE,
      clientId: config.CLIENT_ID,
      scopes: config.SCOPES,
    })

    spinner.succeed('Device code created')

    Logger.log([
      ['Your authentication code is', 'white'],
      [`\n\t ${user_code} \n`, ['white', 'bgBlue']],
    ], ' ')

    Logger.log([
      ['Please open the following URL in your browser to authenticate:', 'white'],
      [verification_uri, ['cyan', 'underline']],
    ], ' ')

    Logger.log([
      ['Press Enter to open your browser, or ', 'white'],
      ['Ctrl+C', ['grey', 'italic']],
      [' to cancel', 'white'],
    ], ' ')

    await waitForEnter(async () => {
      try {
        if (os() === 'Windows_NT') {
          await open(verification_uri, { wait: true, app: { name: apps.browser } })
        } else {
          await open(verification_uri, { wait: true })
        }
      } catch (error: any) {
        command.error('Error opening browser:' + error.message)
        command.info('Please manually open the following URL in your browser:')
        command.info(verification_uri)
        await wait(3000)
      }
    })

    const currentInterval = interval
    let remainingAttempts = 150

    spinner = command.spinner('Waiting for authorization...').start()

    while (true) {
      remainingAttempts -= 1
      if (remainingAttempts < 0) {
        throw new Error('User took too long to respond')
      }

      try {
        const { authentication } = await exchangeDeviceCode({
          clientType: 'oauth-app',
          clientId: config.CLIENT_ID,
          code: device_code,
          scopes: config.SCOPES,
        })

        const octokit = new Octokit({
          auth: authentication.token,
          request: {
            headers: {
              'X-GitHub-Api-Version': '2026-03-10',
              'Accept': 'application/vnd.github+json',
            },
          },
        })

        const { data: user } = await octokit.request('/user')

        if (typeof spinner !== 'undefined') spinner.succeed('Authorization successful')

        return { authentication, user }
      } catch (error: any) {
        if (error.status === 400) {
          const errorCode = error.response.data.error

          if (['authorization_pending', 'slow_down'].includes(errorCode)) {
            await wait(currentInterval * 3000)
          } else if (['expired_token', 'incorrect_device_code', 'access_denied'].includes(errorCode)) {
            throw new Error(errorCode)
          } else {
            throw new Error(`An unexpected error occurred: ${error.message}`)
          }
        } else {
          throw new Error(`An unexpected error occurred: ${error.message}`)
        }
      }
    }
  } catch {
    if (config.CLIENT_ID) {
      spinner.fail('Failed to authenticate user')
    } else {
      spinner.fail('GitHub Client ID not available.')
    }

    return null
  }
}

/**
 * Store login details
 *
 * @param payload
 */
export function storeLoginDetails ({ authentication: payload, user }: { authentication: ILogin, user: IUser }) {
  db.write('user', user)
  db.write('token', payload.token)
  db.write('scopes', payload.scopes)
  db.write('clientId', payload.clientId)
  db.write('clientType', payload.clientType)
}

/**
 * Clear authentication details
 */
export function clearAuth () {
  db.remove('token')
  db.remove('scopes')
  db.remove('clientId')
  db.remove('clientType')
}
