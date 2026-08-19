import { IIssue } from 'src/Contracts/Interfaces'
import { useOctokit } from 'src/hooks'

export interface IListIssuesOptions {
    /** Issue state to fetch, defaults to `all`. */
    state?: 'open' | 'closed' | 'all'
    /** Stop once this many issues (pull requests excluded) have been collected. */
    limit?: number
    /** Page to start from, defaults to `1`. */
    page?: number
    /** Number of records to request per API call (max 100), defaults to `100`. */
    perPage?: number
    /** Only return issues carrying at least one of these labels. */
    labels?: string | string[]
    sort?: 'created' | 'updated' | 'comments'
    direction?: 'asc' | 'desc'
}

/**
 * List the issues of a repository, excluding pull requests.
 *
 * The GitHub REST API returns pull requests from the issues endpoint and offers
 * no way to exclude them, so they have to be filtered client side. That makes it
 * unsafe to drive pagination with the filtered count: a page made entirely of
 * pull requests would look like the end of the list (or like an empty
 * repository) even when more issues follow. Pagination is therefore driven by
 * the raw page size while the limit is measured against actual issues, fetching
 * as many pages as needed to satisfy it.
 *
 * @param owner
 * @param repo
 * @param options
 * @returns The collected issues and the page to resume from (`null` when the
 *          repository has no further pages).
 */
export const listIssues = async (
    owner: string,
    repo: string,
    options: IListIssuesOptions = {}
): Promise<{ issues: IIssue[], nextPage: number | null }> => {
    const { state = 'all', limit, labels, sort, direction } = options
    const perPage = Math.min(Math.max(options.perPage ?? 100, 1), 100)
    const octokit = useOctokit()
    const issues: IIssue[] = []

    let page = Math.max(options.page ?? 1, 1)
    let nextPage: number | null = null

    for (; ;) {
        const { data } = await octokit.issues.listForRepo({
            owner,
            repo,
            state,
            page,
            per_page: perPage,
            sort,
            direction,
            labels: Array.isArray(labels) ? labels.join(',') : labels,
        })

        issues.push(...data.filter(issue => !issue.pull_request))
        page++

        // A short page means the repository has nothing left to give.
        if (data.length < perPage) break

        if (limit && issues.length >= limit) {
            nextPage = page
            break
        }
    }

    return { issues, nextPage }
}

/**
 * Delete an issue from a repository.
 * 
 * Github API does not support deleting issues via REST API.
 * As a workaround, we will use the GraphQL API to delete the issue
 * 
 * @param owner 
 * @param repo 
 * @param issue_number 
 */
export const deleteIssue = async (owner: string, repo: string, issue_number: number, node_id?: string) => {
    const octokit = useOctokit()
    let issueId = node_id

    if (!issueId) {
        // First, we need to get the issue ID using GraphQL if it is not provided
        ({ repository: { issue: { id: issueId } } } = await octokit.graphql<{
            repository: {
                issue: {
                    id: string
                }
            }
        }>(`
            query ($owner: String!, $repo: String!, $issue_number: Int!) {
                repository(owner: $owner, name: $repo) {
                    issue(number: $issue_number) {
                        id
                    }
                }
            }
        `, {
            owner,
            repo,
            issue_number,
        }))
    }

    // Now, we can delete the issue using the issue ID
    await octokit.graphql(`
        mutation ($issueId: ID!) {
            deleteIssue(input: {issueId: $issueId}) {
                clientMutationId
            }
        }
    `, {
        issueId,
    })
}   