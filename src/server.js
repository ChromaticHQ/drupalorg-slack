const { App, LogLevel, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');
const cheerio = require('cheerio');

const config = require('./config');
const datastore = require('./datastore');

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});
const app = new App({
  receiver,
  token: config.slackBotToken,
  logLevel: LogLevel.DEBUG,
});

/**
 * Navigate Drupal.org marketplace pages until the specified organization is
 * found, then calculates the organization's rank and return it.
 *
 * @param {string}  marketplaceUrl  URL of marketplace URL to
 *   search for the orgnization.
 * @param {int}  rankCount  A running counter for determining an organization's rank
 *   across multiple pages.
 *
 * @return {object}  An object containing the organization's marketplace rank
 *   and the index of the page it was found on.
 */
function getDrupalMarketplaceData(marketplaceUrl, rankCount = 0) {
  return axios.get(marketplaceUrl)
    .then((marketplaceResponse) => {
      const html = marketplaceResponse.data;
      const $ = cheerio.load(html, { xmlMode: false });
      const orgsOnPage = $('.view-drupalorg-organizations .view-content').children().length;
      // Determine if the organization node id is listed on the current page.
      if ($(`#node-${config.drupalOrganizationNodeId}`).length) {
        // Find the position of organization node id on the page.
        const foundRank = rankCount + $(`#node-${config.drupalOrganizationNodeId}`).parent().prevAll().length + 1;
        return {
          rank: foundRank,
          page: Math.floor(foundRank / orgsOnPage),
        };
      }
      // The specified organization is not on the current page, go to the next page.
      const nextPageUrl = config.drupalOrgBaseUrl + $('.pager .pager-next a').attr('href');
      const updatedRank = rankCount + orgsOnPage;
      return getDrupalMarketplaceData(nextPageUrl, updatedRank);
    })
    .catch((error) => {
      console.error(error);
    });
}

/**
 * Prepare Slack block payload with marketplace data.
 *
 * @param   {object}  marketplaceData  Object containing organization
 *   marketplace data including rank and page.
 *
 * @return  {object}  Slack payload block object.
 */
const marketplaceRankPayloadBlock = (marketplaceData) => {
  const { rank: marketplaceRank, page: marketplacePage } = marketplaceData;

  const marketplaceMin = datastore.variableGet(config.keyValueDefaults.marketplaceRankMinVarKey);
  if (marketplaceMin === null || marketplaceRank < marketplaceMin) {
    datastore.variableSet(config.keyValueDefaults.marketplaceRankMinVarKey, marketplaceRank);
  }

  const marketplaceTextBase = `:shopping_trolley: <https://www.drupal.org/drupal-services?page=${marketplacePage}|Marketplace> rank: _*${marketplaceRank}*_`;
  const marketplaceText = marketplaceRank <= marketplaceMin
    ? `${marketplaceTextBase} :chart_with_upwards_trend: _*An all-time tracked high*_. :ccoin:`
    : `${marketplaceTextBase} :chart_with_downwards_trend: Down from a tracked high of _${marketplaceMin}_.`;
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: marketplaceText,
    },
  };
};

/**
 * Prepare Slack block payload with issue credit data.
 *
 * @param   {int}  orgDrupalIssueCreditCount  The number of issues credited to
 *   an orgnization.
 *
 * @return  {object}  Slack payload block object.
 */
const issueCreditPayloadBlock = (orgDrupalIssueCreditCount) => {
  const creditCountMax = datastore.variableGet(config.keyValueDefaults.issueCreditCountMaxVarKey);
  // If we don't have a record for issue credits, or the new value from the API is
  // larger, we have a new high; update the record.
  if (creditCountMax === null || orgDrupalIssueCreditCount > creditCountMax) {
    datastore.variableSet(
      config.keyValueDefaults.issueCreditCountMaxVarKey,
      orgDrupalIssueCreditCount,
    );
  }

  const creditCountTextBase = `:female-technologist: Issue credit count: _*${orgDrupalIssueCreditCount}*_`;
  const creditCountText = orgDrupalIssueCreditCount < creditCountMax
    ? `${creditCountTextBase} :chart_with_downwards_trend: Down from a tracked high of _${creditCountMax}_.`
    : `${creditCountTextBase} :chart_with_upwards_trend: _*An all-time tracked high*_. :ccoin:`;
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: creditCountText,
    },
  };
};

/**
 * Prepare Slack block payload with supported project data.
 *
 * @param   {int}  orgDrupalProjectsSupported  The number of supported projects
 *   credited to an organization.
 *
 * @return  {object}  Slack payload block object.
 */
const projectsSupportedPayloadBlock = (orgDrupalProjectsSupported) => {
  const projectsSupportedMax = datastore.variableGet(
    config.keyValueDefaults.projectsSupportedMaxVarKey,
  );
  // If we don't have a record for projects supported, or the new value from the API is
  // larger, we have a new high; update the record.
  if (projectsSupportedMax === null || orgDrupalProjectsSupported > projectsSupportedMax) {
    datastore.variableSet(
      config.keyValueDefaults.projectsSupportedMaxVarKey,
      orgDrupalProjectsSupported,
    );
  }

  const projectsSupportedTextBase = `:female-construction-worker: Projects supported: _*${orgDrupalProjectsSupported}*_`;
  const projectsSupportedText = orgDrupalProjectsSupported < projectsSupportedMax
    ? `${projectsSupportedTextBase} :chart_with_downwards_trend: Down from a tracked high of _${projectsSupportedMax}_.`
    : `${projectsSupportedTextBase} :chart_with_upwards_trend: _*An all-time tracked high*_. :ccoin:`;
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: projectsSupportedText,
    },
  };
};

/**
 * Prepare Slack block payload with case study data.
 *
 * @param   {int}  caseStudiesCount  The number of case studies credited to an
 *   organization.
 *
 * @return  {object}  Slack payload block object.
 */
const caseStudiesPayloadBlock = (caseStudiesCount) => {
  const caseStudiesPublishedMax = datastore.variableGet(
    config.keyValueDefaults.caseStudiesPublishedMaxVarKey,
  );
  // If we don't have a record for case studies, or the new value from the API is
  // larger, we have a new high; update the record.
  if (caseStudiesPublishedMax === null || caseStudiesCount > caseStudiesPublishedMax) {
    datastore.variableSet(
      config.keyValueDefaults.caseStudiesPublishedMax,
      caseStudiesCount,
    );
  }

  const caseStudiesTextBase = `:blue_book: Case studies published: _*${caseStudiesCount}*_`;
  const caseStudiesText = caseStudiesCount < caseStudiesPublishedMax
    ? `${caseStudiesTextBase} :chart_with_downwards_trend: Down from a tracked high of _${caseStudiesPublishedMax}_.`
    : `${caseStudiesTextBase} :chart_with_upwards_trend: _*An all-time tracked high*_. :ccoin:`;
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: caseStudiesText,
    },
  };
};

/**
 * Compiles all payload blocks for inclusion in a Slack message attachment.
 *
 * @param   {object}  orgNode  A drupal.org organization node object.
 * @param   {object}  marketplaceData  The HTML contents of a Drupal.org
 *   marketplace page.
 * @param   {object}  caseStudiesResponse  Response data from Drupal.org's
 *   API containing case studies.
 *
 * @return  {object}  An object containing multiple Slack Block Kit blocks to
 *   attach to a message object.
 */
const drupalOrgPayloadBlocks = (orgNode, marketplaceData, caseStudiesResponse) => {
  const blocks = [];
  // Header.
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: config.slackNotificationText,
    },
  });
  blocks.push({
    type: 'divider',
  });

  // Content.
  blocks.push(marketplaceRankPayloadBlock(marketplaceData));
  blocks.push(issueCreditPayloadBlock(orgNode.field_org_issue_credit_count));
  blocks.push(projectsSupportedPayloadBlock(orgNode.projects_supported.length));
  blocks.push(caseStudiesPayloadBlock(caseStudiesResponse.list.length));

  // Footer.
  blocks.push({
    type: 'divider',
  });
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: 'For more info, see https://www.drupal.org/chromatic.',
      },
    ],
  });
  return blocks;
};

/**
 * Generate a Slack message payload object.
 *
 * @param   {string}  channelId  A Slack channel ID.
 * @param   {string}  userId  A user ID from the requesting Slack user, if
 *   applicable.
 * @param   {string}  responseType  A Slack message type, either 'in_channel',
 *   or 'ephemeral'.
 *
 * @return  {object}  A fully completed object to send a message to Slack.
 */
const slackNotificationPayload = async (channelId, userId, responseType) => {
  const [orgNodeResponse, marketplaceData, caseStudiesResponse] = await Promise.all([
    axios.get(`https://www.drupal.org/api-d7/node/${config.drupalOrganizationNodeId}.json`),
    getDrupalMarketplaceData(`${config.drupalOrgBaseUrl}${config.drupalOrgMarketplacePath}`),
    axios.get(`https://www.drupal.org/api-d7/node.json?type=casestudy&taxonomy_vocabulary_5=20236&field_case_organizations=${config.drupalOrganizationNodeId}`),
  ]);

  return {
    token: config.slackBotToken,
    channel: channelId,
    user: userId,
    response_type: responseType,
    text: '',
    attachments: [
      {
        blocks: drupalOrgPayloadBlocks(
          orgNodeResponse.data,
          marketplaceData,
          caseStudiesResponse.data,
        ),
      },
    ],
  };
};

/**
 * Generates a payload to send a descriptive error to Slack.
 *
 * @param   {string}  channelId  A Slack channel ID.
 * @param   {string}  userId  A user ID from the requesting Slack user, if
 *   applicable.
 * @param   {string}  responseType  A Slack message type, either 'in_channel',
 *   or 'ephemeral'.
 * @param   {string}  error  An error message.
 *
 * @return  {object}  A fully completed object to send a message to Slack.
 */
const slackErrorPayload = (channelId, userId, responseType, error) => {
  const payload = {
    token: config.slackBotToken,
    channel: channelId,
    user: userId,
    response_type: responseType,
    text: `An unknown error has occurred: \`${error}\``,
  };
  return payload;
};

/**
 * Listens for a Slack 'slash' command.
 */
app.command('/dorank', async ({ command, ack, respond }) => {
  // Acknowledge Slack command request.
  await ack();

  if (config.verboseMode) {
    console.log(command);
  }

  let payload;
  try {
    payload = await slackNotificationPayload(command.channel_id, command.user_id, 'ephemeral');
    return await respond(payload);
  } catch (error) {
    console.error(error);
    payload = await slackErrorPayload(command.channel_id, command.user_id, 'ephemeral', error);
    return respond(payload);
  }
});

/**
 * Endpoint that listens for a trigger by a non-Slack event like a Jenkins job
 * for a weekly notification in the configured channel.
 */
receiver.app.post('/triggers', async (request, response, next) => {
  let status = 200;
  let message = 'OK';

  if (request.query.token !== config.orgToken) {
    response.status(403);
    return response.send();
  }
  try {
    const payload = await slackNotificationPayload(config.channelId, null, 'in_channel');
    app.client.chat.postMessage(payload);
  } catch (error) {
    status = 500
    message = error.message;
    console.error(error);
  }
  response.status(status);
  return response.send(message);
});

receiver.app.get('/', (_, res) => {
  // Respond 200 OK to the default health check method.
  res.status(200).send();
});

(async () => {
  // Start the app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️ Bolt app is running!');
})();
