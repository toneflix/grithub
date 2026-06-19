import { RestEndpointMethodTypes } from '@octokit/rest'
import { XGeneric } from './Generic'

export type IIssue = RestEndpointMethodTypes['issues']['listForRepo']['response']['data'][number]

export interface IResponse<X = XGeneric> {
    status: boolean
    message: string
    data: X
}

export interface IIssueMetadata {
    type?: 'Feature' | 'Bug' | 'Enhancement' | 'Documentation' | 'Task'
    name?: string
    title?: string
    labels?: string
    assignees?: string
}

export interface IIssueFile {
    filePath?: string
    title: string
    type: IIssueMetadata['type']
    body?: string | null | undefined
    labels: string[]
    assignees?: string[]
    fileName?: string
}

export interface IConfig {
    debug: boolean
    apiBaseURL: string
    useCurrentRepo: boolean | 'repo'
    timeoutDuration: number
    ngrokAuthToken?: string
    skipLongCommandGeneration?: boolean
    /**
     * When the current repo's remote is SSH, reuse the cached HTTPS git
     * credential (SSH remote is converted to HTTPS) to authenticate API calls.
     * Disable this if that credential may belong to a different account than the
     * one you log in to ghit with; ghit then falls back to the logged-in user token.
     */
    reuseSshCredential?: boolean
}

export interface IRepoEntry {
    id: number
    name: string
    full_name: string
    private: boolean
    ssh_url: string
    clone_url: string
}

export interface IUser {
    login: string
    id: number
    node_id: string
    avatar_url: string
    gravatar_id: string
    url: string
    html_url: string
    followers_url: string
    following_url: string
    gists_url: string
    starred_url: string
    subscriptions_url: string
    organizations_url: string
    repos_url: string
    events_url: string
    received_events_url: string
    type: 'User' | 'Organization',
    user_view_type: 'public' | 'private',
    site_admin: false,
    name: string,
    company: string,
    blog: string,
    location: string,
    email: string | null,
    hireable: boolean,
    bio: string,
    twitter_username: string,
    notification_email?: string | null,
    public_repos: number,
    public_gists: number,
    followers: number,
    following: number,
    created_at: string,
    updated_at: string
}

export interface ILogin {
    clientType: 'oauth-app' | 'github-app'
    clientId: string
    token: string
    scopes: string[]
}

export interface IIntegration {
    business_name: string
    description: string
    rc_number: string | null
    phone: string
    email: string
    address: string
    product_name: string | null
    registration_document_number: string | null
    registration_document_type: string | null
    primary_contact_name: string | null
    primary_contact_email: string | null
    primary_contact_phone: string | null
    support_email: string
    chargeback_email: string
    logo_path: string
    integration_agreement_path: string | null
    settlement_bank: string | null
    account_number: string | null
    registration_document_path: string | null
    risk_level: 'low' | 'medium' | 'high' | null
    isw_category: number
    mcc_category: string | null
    flat_rate: number
    charge_percentage: number
    international_flat_rate: number
    international_charge_percentage: number
    flat_threshhold: number
    transfer_charge: number
    settlement_schedule: string
    test_redirect_url: string
    test_webhook_endpoint: string
    live_redirect_url: string | null
    live_webhook_endpoint: string | null
    test_integration_url: string | null
    test_integration_instruction: string | null
    email_notification: string
    pwc_id: number,
    is_live: boolean,
    go_live_requested: boolean,
    go_live_requested_at: string | null,
    live_keys_requested: boolean,
    live_keys_requested_at: string | null,
    reviewed_at: string | null,
    setup_complete: boolean,
    receipts: boolean,
    display_state: string,
    active: boolean,
    short_name: string | null,
    international_toggle_disabled: boolean,
    allow_international_cards: boolean,
    active_channels: string[],
    allowed_currencies: string[],
    allow_whitelist: boolean,
    charge_from_dashboard: boolean,
    can_transfer: boolean,
    transfer_using_otp: boolean,
    payouts_on_hold: boolean,
    go_live_date: string | null,
    payments_session_timeout: number,
    metadata: { new_checkout_enabled: boolean },
    transfer_notification: string,
    business_category: string,
    business_size: string,
    business_type: string,
    website_url: string | null,
    is_under_investigation: null,
    is_disabled: boolean,
    disable_reason: null | string,
    disable_at: null | string,
    identity_evidence_path: null | string,
    director_identity_evidence_path: null | string,
    bvn: null | string,
    bvn_date_of_birth: null | string,
    go_live_status: null | string,
    registration_packet_path: null | string,
    default_currency: string
    transfer_notification_to_recipient: string
    send_transfer_email_otp: boolean,
    fast_checkout_enabled: boolean,
    id: number
    primary_user: number
    organization: number
    createdAt: string
    updatedAt: string
    consent_received: boolean
    terminal_integration_attribute: null,
    is_terminal_active: false,
    is_dormant: false,
    is_registration_type_supported_for_terminal: false
    available_channels: ('bank' | 'card' | 'ussd' | 'bank_transfer' | 'payattitude')[]
    logged_in_user_role?: string
}