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
 * Navigate Drupal.org marketplace pages until the specified
 * organization is found, then calculates the organization's
 * rank and return it.
 *
 * @param {string} marketplaceUrl URL of marketplace URL to
 *   search for the orgnization.
 * @param {int} rankCount
 *   A running counter for determining an organization's rank
 *   across multiple pages.
 * @return {object}
 *   An object containing the organization's marketplace rank
 *  and the index of the page it was found on.
 */
function getDrupalMarketplaceData(marketplaceUrl, rankCount = 0) {
  return axios.get(marketplaceUrl)
    .then((marketplaceResponse) => {
      const html = marketplaceResponse.data;
      const $ = cheerio.load(html, { xmlMode: false });
      const orgsOnPage = $('.view-drupalorg-organizations .view-content').children().length;
      // Determine if Chromatic is listed on the current page.
      if ($(`#node-${config.drupalOrganizationNodeId}`).length) {
        // Find the position of Chromatic on the page.
        const foundRank = rankCount + $(`#node-${config.drupalOrganizationNodeId}`).parent().prevAll().length + 1;
        return {
          rank: foundRank,
          page: Math.floor(foundRank / orgsOnPage),
        };
      }
      // Chromatic is not on the current page, go to the next page.
      const nextPageUrl = config.drupalOrgBaseUrl + $('.pager .pager-next a').attr('href');
      const updatedRank = rankCount + orgsOnPage;
      return getDrupalMarketplaceData(nextPageUrl, updatedRank);
    })
    .catch((error) => {
      console.error(error);
    });
}

const marketplaceRankPayloadBlock = (marketplaceData) => {
  const { rank: marketplaceRank, page: marketplacePage } = marketplaceData;

  const marketplaceMin = datastore.variableGet(config.keyValueDefaults.marketplaceRankMinVarKey);
  if (marketplaceMin === null || marketplaceRank < marketplaceMin) {
    datastore.variableset(config.keyValueDefaults.marketplaceRankMinVarKey, marketplaceRank);
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

const projectsSupportedPayloadBlock = (orgDrupalProjectsSupported) => {
  const projectsSupportedMax = datastore.variableGet(config.keyValueDefaults.projectsSupportedMaxVarKey);
  // If we don't have a record for org_projects_supported_max, or the new value from the API is
  // larger, we have a new high; update the record.
  if (projectsSupportedMax === null || orgDrupalProjectsSupported > projectsSupportedMax) {
    datastore.variableSet(
      config.keyValueDefaults.projectsSupportedMaxVarKey,
      orgDrupalProjectsSupported,
    );
  }

  const projectsSupportedTextBase = `:female-construction-worker: Supported projects: _*${orgDrupalProjectsSupported}*_`;
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

const drupalOrgPayloadBlocks = (orgNode, marketplaceData) => {
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

const slackNotificationPayload = async (channelId, userId, responseType) => {
  const [orgNodeResponse, marketplaceData] = await Promise.all([
    axios.get(`https://www.drupal.org/api-d7/node/${config.drupalOrganizationNodeId}.json`),
    getDrupalMarketplaceData(`${config.drupalOrgBaseUrl}${config.drupalOrgMarketplacePath}`),
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
        ),
      },
    ],
  };
};

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

// Listen for a slash command.
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

// This endpoint is triggered by a non-Slack event like a Jenkins job for a
// weekly notification in the configured channel.
receiver.app.post('/triggers', async (request, response, next) => {
  if (request.query.token !== config.orgToken) {
    response.status(403);
    return response.send();
  }
  try {
    const payload = await slackNotificationPayload(config.channels.channelId, null, 'in_channel');
    app.client.chat.postMessage(payload);
  } catch (error) {
    console.error(error);
  }
  response.status(200);
  return response.send();
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
