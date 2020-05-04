const { App, LogLevel, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');
const cheerio = require('cheerio');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const config = require('./config');

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});
const app = new App({
  receiver,
  token: config.slackBotToken,
  logLevel: LogLevel.DEBUG,
});

// Setup a new database.
// Persisted using async file storage.
// Security note: the database is saved to the file `db.json` on the local filesystem.
// It's deliberately placed in the `.data` directory which doesn't get copied if
// someone remixes the project.
const adapter = new FileSync('.data/db.json');
const db = low(adapter);

// Default key/value list.
const issueCreditCountMaxVarKey = 'org_issue_credit_count_max';
const marketplaceRankMinVarKey = 'org_marketplace_rank_min';
const projectsSupportedMaxVarKey = 'org_projects_supported_max';

// default data.
db.defaults({
  keyvalues: [
    { name: issueCreditCountMaxVarKey, value: null },
    { name: marketplaceRankMinVarKey, value: null },
    { name: projectsSupportedMaxVarKey, value: null },
  ],
}).write();

/**
 * Navigate Drupal.org marketplace pages until the specified
 * organization is found, then calculates the organization's
 * rank and return it.
 *
 * @param {marketplaceUrl} string URL of marketplace URL to
 *   search for the orgnization.
 * @param {rankCount} int A running counter for determining
 *   an organization's rank across multiple pages.
 * @return {object} An object containing the organization's
 *   marketplace rank and the index of the page it was found
 *   on.
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

  const historicalMarketplaceMin = db.get('keyvalues').find({ name: marketplaceRankMinVarKey }).value().value;
  if (config.verboseMode) {
    console.log(`${marketplaceRankMinVarKey}: ${historicalMarketplaceMin}`);
  }
  if (historicalMarketplaceMin === null || marketplaceRank < historicalMarketplaceMin) {
    db.get('keyvalues')
      .find({ name: marketplaceRankMinVarKey })
      .assign({ value: marketplaceRank })
      .write();
  }

  const marketplaceTextBase = `:shopping_trolley: <https://www.drupal.org/drupal-services?page=${marketplacePage}|Marketplace> rank: _*${marketplaceRank}*_`;
  const marketplaceText = marketplaceRank <= historicalMarketplaceMin
    ? `${marketplaceTextBase} :chart_with_upwards_trend: _*An all-time tracked high*_. :ccoin:`
    : `${marketplaceTextBase} :chart_with_downwards_trend: Down from a tracked high of _${historicalMarketplaceMin}_.`;
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: marketplaceText,
    },
  };
};

const issueCreditPayloadBlock = (orgNode) => {
  const orgDrupalIssueCreditCount = orgNode.field_org_issue_credit_count;

  const historicalCreditCountMax = db.get('keyvalues').find({ name: issueCreditCountMaxVarKey }).value().value;
  console.log(`historicalCreditCountMax: ${historicalCreditCountMax}`);
  // If we don't have a record for issue_credit_count_max, or the new value from the API is
  // larger, we have a new high; update the record.
  if (historicalCreditCountMax === null || orgDrupalIssueCreditCount > historicalCreditCountMax) {
    if (config.verboseMode) {
      console.log(`Updating ${issueCreditCountMaxVarKey}: ${orgDrupalIssueCreditCount}`);
    }
    db.get('keyvalues')
      .find({ name: issueCreditCountMaxVarKey })
      .assign({ value: orgDrupalIssueCreditCount })
      .write();
  }

  const creditCountTextBase = `:female-technologist: Issue credit count: _*${orgDrupalIssueCreditCount}*_`;
  const creditCountText = orgDrupalIssueCreditCount < historicalCreditCountMax
    ? `${creditCountTextBase} :chart_with_downwards_trend: Down from a tracked high of _${historicalCreditCountMax}_.`
    : `${creditCountTextBase} :chart_with_upwards_trend: _*An all-time tracked high*_. :ccoin:`;
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: creditCountText,
    },
  };
};

const projectsSupportedPayloadBlock = (orgNode) => {
  const orgDrupalProjectsSupported = orgNode.projects_supported.length;

  // @TODO: Track high count.
  const historicalProjectsSupportedMax = db.get('keyvalues').find({ name: projectsSupportedMaxVarKey }).value().value;
  console.log(`projectsSupportedMaxVarKey: ${historicalProjectsSupportedMax}`);

  // If we don't have a record for org_projects_supported_max, or the new value from the API is
  // larger, we have a new high; update the record.
  if (historicalProjectsSupportedMax === null
      || orgDrupalProjectsSupported > historicalProjectsSupportedMax) {
    if (config.verboseMode) {
      console.log(`Updating ${projectsSupportedMaxVarKey}: ${orgDrupalProjectsSupported}`);
    }
    db.get('keyvalues')
      .find({ name: projectsSupportedMaxVarKey })
      .assign({ value: orgDrupalProjectsSupported })
      .write();
  }

  const projectsSupportedTextBase = `:female-construction-worker: Supported projects: _*${orgDrupalProjectsSupported}*_`;
  const projectsSupportedText = orgDrupalProjectsSupported < historicalProjectsSupportedMax
    ? `${projectsSupportedTextBase} :chart_with_downwards_trend: Down from a tracked high of _${historicalProjectsSupportedMax}_.`
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

  blocks.push(marketplaceRankPayloadBlock(marketplaceData));

  blocks.push(issueCreditPayloadBlock(orgNode));

  blocks.push(projectsSupportedPayloadBlock(orgNode));

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
