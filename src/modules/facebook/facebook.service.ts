import { Injectable } from '@nestjs/common';
import { FacebookMediaRepositoryService } from '@database/dynamodb/repository-services/facebook.media.service';
import { FacebookAccountRepositoryService } from '@database/dynamodb/repository-services/facebook.account.service';
import { FacebookAccountLinkingRepositoryService } from '@database/dynamodb/repository-services/facebook.account.linking.service';
import { FacebookApiService } from '../utils/facebook/api.service';
import { GoogleUserRepositoryService } from '@database/dynamodb/repository-services/google.user.service';
import { FacebookUserRepositoryService } from '@database/dynamodb/repository-services/facebook.user.service';
import {
  normalizeFacebookPost,
  presentFacebookMedia,
} from './facebook-post.mapper';

/**
 * Business logic for Facebook post automation settings (get / store) plus the
 * post-list / ingestion / Page-connect flows the frontend needs.
 * Faithful mirror of the Instagram post-automation methods in
 * InstagramAccountService — same data model (`ai_enabled`, `tag_and_value_pair`)
 * with the per-post settings living on the media record and the account-level
 * defaults living on the Facebook Page (account) record.
 */
@Injectable()
export class FacebookAccountService {
  constructor(
    private readonly facebookMediaRepositoryService: FacebookMediaRepositoryService,
    private readonly facebookAccountRepositoryService: FacebookAccountRepositoryService,
    private readonly facebookAccountLinkingRepository: FacebookAccountLinkingRepositoryService,
    private readonly facebookApiService: FacebookApiService,
    private readonly googleUserRepository: GoogleUserRepositoryService,
    private readonly facebookUserRepository: FacebookUserRepositoryService,
  ) { }

  // ---------------------------------------------------------------------------
  // Per-post (media) automation
  // ---------------------------------------------------------------------------

  /** Store automation settings for a single Facebook post. */
  async addFacebookMediaAutomation(
    mediaId: string,
    input: Record<string, any>,
  ) {
    try {
      console.log('received input:', input);
      if (input === undefined || input === null) {
        throw new Error('Input is undefined or null');
      }
      input['id'] = mediaId;
      return await this.facebookMediaRepositoryService.updateMediaDetails(input);
    } catch (error) {
      console.error(
        `Error inserting automation details for ${mediaId}:`,
        error,
      );
      throw error;
    }
  }

  /** Store the response-type / config for a single Facebook post. */
  async updateMediaResponseTypeOnTable(
    mediaId: string,
    response: Record<string, any>,
  ) {
    try {
      console.log('received input:', response);
      if (!response) {
        throw new Error('Input is undefined or null');
      }
      response['id'] = mediaId;
      return await this.facebookMediaRepositoryService.updateMediaDetails(
        response,
      );
    } catch (error) {
      console.error(`Error inserting response details for ${mediaId}:`, error);
      throw error;
    }
  }

  /** Fetch the full media record + a derived `is_automated` flag. */
  async getMediaResponseTypeFromTable(mediaId: string) {
    try {
      const response =
        await this.facebookMediaRepositoryService.getMedia(mediaId);
      const item = response?.Item;
      // Not ingested yet — the caller only needs to know there is no automation.
      if (!item) return { is_automated: false };
      return {
        ...presentFacebookMedia(item),
        is_automated: this.isAutomatedPost(item),
      };
    } catch (error) {
      console.error(`Error getting media details for media ${mediaId}:`, error);
      throw error;
    }
  }

  /** Fetch only the keyword tag/value trigger pairs for a post. */
  async getTagAndValuePairFromTable(mediaId: string) {
    const response =
      await this.facebookMediaRepositoryService.getMedia(mediaId);
    const tagAndValuePair = response?.Item?.tag_and_value_pair ?? {};
    return tagAndValuePair;
  }

  /** Fetch the AI-enabled flags for a post. */
  async getAIEnabledInfoFromTable(mediaId: string) {
    const response =
      await this.facebookMediaRepositoryService.getMedia(mediaId);
    return {
      positive_comments: response?.Item?.positive_comments ?? false,
      negative_comments: response?.Item?.negative_comments ?? false,
      inquiries: response?.Item?.inquiries ?? {},
      lead: response?.Item?.lead ?? false,
      potential_buyers: response?.Item?.potential_buyers ?? false,
    };
  }

  // ---------------------------------------------------------------------------
  // Post list + ingestion
  // ---------------------------------------------------------------------------

  /**
   * Return all stored posts for a Page (sorted newest-first) with a derived
   * `is_automated` flag. Reads from `facebook_media_repository` only — does not
   * hit the Graph API. Mirrors getInstagramMediaFromTable.
   */
  async getFacebookMediaFromTable(accountId: string) {
    try {
      const response =
        await this.facebookMediaRepositoryService.getMediaByAccountId(accountId);
      const items = response?.Items || [];

      if (Array.isArray(items)) {
        return items
          .sort(
            (a, b) =>
              new Date(b.timestamp || 0).getTime() -
              new Date(a.timestamp || 0).getTime(),
          )
          .map((item) => ({
            ...presentFacebookMedia(item),
            is_automated: this.isAutomatedPost(item),
          }));
      }

      console.warn('Unexpected response type, expected an array:', response);
      return [];
    } catch (error) {
      console.error(`Error getting media details for ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch the Page's recent posts from the Graph API and upsert them into
   * `facebook_media_repository`. Partial update keeps automation settings
   * intact. Mirrors updateAccountMediaOnTable.
   */
  async updateAccountMediaOnTable(accountId: string) {
    try {
      console.log(`Updating media for accountId: ${accountId}`);

      const account =
        await this.facebookAccountRepositoryService.getAccount(accountId);
      if (!account) throw new Error('Account not found');
      if (!account.access_token) throw new Error('Page access token not found');

      const posts = await this.facebookApiService.getAllPagePosts(
        accountId,
        account.access_token,
      );

      if (!posts || posts.length === 0) {
        console.warn(`No posts found for accountId: ${accountId}`);
        return [];
      }

      for (const post of posts) {
        const media = normalizeFacebookPost(post, accountId);
        await this.facebookMediaRepositoryService.updateMediaDetails(media);
      }

      console.log('media fetched and inserted successfully.');
      return { success: true, message: 'Media updated successfully' };
    } catch (error) {
      console.error(`Error updating media for ${accountId}:`, error);
      return { success: false, message: 'Error updating media in the table' };
    }
  }

  // ---------------------------------------------------------------------------
  // Page connection (onboarding)
  // ---------------------------------------------------------------------------

  /**
   * Pull the Pages the user manages from the Graph API (using a USER access
   * token the frontend obtained via Facebook Login) and upsert them into
   * `facebook_account_repository` against the authenticated influex user.
   * Uses a partial update so re-connecting never wipes a Page's automation
   * defaults. Page access tokens are stored but never returned to the client.
   */
  async connectPages(
    providerUserId: string,
    loginSource: 'google' | 'facebook',
    userAccessToken: string,
  ) {
    if (!userAccessToken) {
      throw new Error('access_token is required to connect Facebook pages');
    }

    const influexUserId = await this.resolveInfluexUserId(
      providerUserId,
      loginSource,
    );
    if (!influexUserId) {
      throw new Error('User not found');
    }

    // CRITICAL: exchange the short-lived user token for a long-lived one FIRST.
    // Page tokens derived from a long-lived user token never expire; deriving
    // them from a short-lived token is what caused the "session expired"
    // (OAuthException 190) failures. Fall back to the raw token only if the
    // exchange itself fails, so a transient error still connects (degraded).
    let longLivedUserToken = userAccessToken;
    let userTokenExpiresAt: string | null = null;
    try {
      const exchanged =
        await this.facebookApiService.exchangeForLongLivedUserToken(
          userAccessToken,
        );
      longLivedUserToken = exchanged.access_token;
      userTokenExpiresAt = new Date(
        Date.now() + exchanged.expires_in * 1000,
      ).toISOString();
    } catch (err) {
      console.warn(
        'Long-lived token exchange failed; using short-lived token (page tokens may expire):',
        (err as Error).message,
      );
    }

    const pages =
      await this.facebookApiService.getUserPages(longLivedUserToken);

    const connected: Array<Record<string, any>> = [];
    for (const page of pages) {
      // Check whether this Page is already connected under a different influex
      // user (e.g. a different gmail login). If so, don't steal ownership by
      // overwriting `user_id` — just link this user as a secondary user,
      // mirroring how Instagram accounts are shared across multiple users.
      const existingAccount =
        await this.facebookAccountRepositoryService.getAccount(page.id);

      if (existingAccount?.user_id && existingAccount.user_id !== influexUserId) {
        await this.facebookAccountLinkingRepository.addLink(
          influexUserId,
          page.id,
        );
        // Still refresh the page token / user token bookkeeping so the page
        // stays healthy, but leave the original owner's `user_id` intact.
        await this.facebookAccountRepositoryService.updateAccountDetails({
          id: page.id,
          access_token: page.access_token,
          user_access_token: longLivedUserToken,
          user_token_expires_at: userTokenExpiresAt,
          token_status: 'active',
        });
      } else {
        await this.facebookAccountRepositoryService.updateAccountDetails({
          id: page.id,
          user_id: influexUserId,
          access_token: page.access_token,
          // Kept for re-deriving page tokens later (refresh endpoint) and for
          // surfacing token health to the frontend.
          user_access_token: longLivedUserToken,
          user_token_expires_at: userTokenExpiresAt,
          token_status: 'active',
          name: page.name,
          category: page.category ?? null,
          picture: page?.picture?.data?.url ?? null,
        });
      }

      // Subscribe the Page to our app's `feed` webhooks so Meta delivers its
      // comment events to the ingress Lambda. Non-fatal: a transient failure
      // here must not break an otherwise-good connection or skip later pages.
      try {
        const subscribed = await this.facebookApiService.subscribePageToApp(
          page.id,
          page.access_token,
        );
        if (!subscribed) {
          console.warn(
            `Page ${page.id} subscribed_apps did not return success`,
          );
        }
      } catch (err) {
        console.warn(
          `Failed to subscribe page ${page.id} to webhooks (non-fatal):`,
          (err as Error).message,
        );
      }

      connected.push({
        id: page.id,
        name: page.name,
        category: page.category ?? null,
        picture: page?.picture?.data?.url ?? null,
      });
    }

    return { success: true, count: connected.length, pages: connected };
  }

  /**
   * List the Facebook Pages connected to the authenticated user. Page access
   * tokens are stripped from the response.
   */
  async getConnectedPages(
    providerUserId: string,
    loginSource: 'google' | 'facebook',
  ) {
    const influexUserId = await this.resolveInfluexUserId(
      providerUserId,
      loginSource,
    );
    if (!influexUserId) return [];

    // Pages this user owns directly (they ran the original connect flow).
    const directPages =
      await this.facebookAccountRepositoryService.getAccountDetailsByUserId(
        influexUserId,
      );

    // Pages this user was linked to as a secondary user (the Page was already
    // owned by a different influex user when they connected).
    const linkedIds =
      await this.facebookAccountLinkingRepository.getLinkedAccountIds(
        influexUserId,
      );
    const linkedPages = await Promise.all(
      linkedIds.map((id) => this.facebookAccountRepositoryService.getAccount(id)),
    );

    const seen = new Set<string>();
    const pages = [...directPages, ...linkedPages].filter(
      (p): p is Record<string, any> => {
        if (!p) return false;
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      },
    );

    return pages.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      picture: p.picture ?? null,
      // `expired` => the page token is dead; the frontend should prompt the
      // user to reconnect (re-run pages/connect with a fresh login token).
      token_status: p.token_status ?? 'active',
      needs_reconnect: (p.token_status ?? 'active') === 'expired',
      // Shopify integration is not yet supported for Facebook Pages.
      // The field is included so the frontend can read it consistently;
      // it will be false until the feature is built.
      is_shopify_connected: p.is_shopify_connected ?? false,
    }));
  }

  /**
   * Flag a Page as having a dead token so the frontend can prompt a reconnect.
   * Called when a Graph call returns OAuthException 190. Best-effort.
   */
  async markPageTokenExpired(accountId: string) {
    try {
      await this.facebookAccountRepositoryService.updateAccountDetails({
        id: accountId,
        token_status: 'expired',
      });
    } catch (err) {
      console.warn(
        `Failed to mark page ${accountId} token expired:`,
        (err as Error).message,
      );
    }
  }

  /**
   * Disconnect a Facebook Page: removes all of its stored posts from
   * `facebook_media_repository` and deletes the Page record (and its stored
   * Page access token + automation defaults) from `facebook_account_repository`.
   */
  async disconnectPage(accountId: string) {
    try {
      // Read the Page token BEFORE deleting the record so we can tell Meta to
      // stop sending this Page's webhooks. Non-fatal: a failed unsubscribe must
      // not block the disconnect (the record is going away regardless).
      const account =
        await this.facebookAccountRepositoryService.getAccount(accountId);
      const pageToken = account?.access_token;
      if (pageToken) {
        try {
          await this.facebookApiService.unsubscribePageFromApp(
            accountId,
            pageToken,
          );
        } catch (err) {
          console.warn(
            `Failed to unsubscribe page ${accountId} from webhooks (non-fatal):`,
            (err as Error).message,
          );
        }
      }

      await this.facebookMediaRepositoryService.deleteAccount(accountId);
      await this.facebookAccountRepositoryService.deleteAccount(accountId);
      return {
        success: true,
        message: `Disconnected facebook page ${accountId}`,
      };
    } catch (error) {
      console.error(`Error disconnecting page ${accountId}:`, error);
      throw error;
    }
  }

  /** Resolve the influex user id behind a provider (google/facebook) login. */
  private async resolveInfluexUserId(
    providerUserId: string,
    loginSource: 'google' | 'facebook',
  ): Promise<string | undefined> {
    if (loginSource === 'google') {
      return (await this.googleUserRepository.getGoogleUser(providerUserId)).Item
        ?.user_id;
    }
    if (loginSource === 'facebook') {
      return (await this.facebookUserRepository.getFacebookUser(providerUserId))
        .Item?.user_id;
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Account-level (Facebook Page) automation defaults
  // ---------------------------------------------------------------------------

  /** Fetch the account-level automation defaults for a Facebook Page. */
  async getAccountPostAutomation(accountId: string) {
    try {
      const items =
        await this.facebookAccountRepositoryService.getAccount(accountId);
      console.log('account details:', items);

      if (!items) {
        throw new Error(`Account not found: ${accountId}`);
      }
      const result = {
        tag_and_value_pair: items.tag_and_value_pair,
        ai_enabled: items.ai_enabled,
        reply_to_all: items.reply_to_all === true,
        hide_negative: items.hide_negative === true,
      };
      return result;
    } catch (error) {
      console.log(
        `Failed to fetch the account level automation ${accountId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Normalize the `tag_and_value_pair` payload for the account-level
   * automation endpoint. The payload is an array of trigger pairs; each
   * pair's `tag` defaults to `[]`, `value`/`dm` default to `''` whenever
   * missing or the wrong type.
   */
  private normalizeTagAndValuePair(input: any) {
    const pairs = Array.isArray(input) ? input : [];
    return pairs.map((pair) => ({
      tag: Array.isArray(pair?.tag) ? pair.tag : [],
      value: typeof pair?.value === 'string' ? pair.value : '',
      dm: typeof pair?.dm === 'string' ? pair.dm : '',
    }));
  }

  /** Store the account-level automation defaults for a Facebook Page. */
  async putAccountPostAutomation(
    accountId: string,
    input: Record<string, any>,
  ) {
    try {
      return await this.facebookAccountRepositoryService.updateAccountDetails({
        id: accountId,
        ai_enabled: input.ai_enabled,
        tag_and_value_pair: this.normalizeTagAndValuePair(
          input.tag_and_value_pair,
        ),
        reply_to_all: input.reply_to_all === true,
        hide_negative: input.hide_negative === true,
      });
    } catch (error) {
      console.log(
        `Failed to Put the account level automation ${accountId}:`,
        error,
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * A post counts as "automated" if any ai_enabled category has a mode other
   * than `leave_comment`, OR it has at least one tag/value trigger pair.
   * Identical to InstagramAccountService.isAutomatedPost.
   */
  private isAutomatedPost(image: any): boolean {
    const ai_enabled = image?.ai_enabled;
    const tag_and_value_pair = image?.tag_and_value_pair;

    if (ai_enabled && typeof ai_enabled === 'object') {
      for (const category of Object.values(ai_enabled)) {
        if (category && typeof category === 'object') {
          const mode = (category as any)?.mode;
          if (mode && mode !== 'leave_comment') {
            return true;
          }
        }
      }
    }

    if (Array.isArray(tag_and_value_pair) && tag_and_value_pair.length > 0) {
      return true;
    }

    return false;
  }
}
