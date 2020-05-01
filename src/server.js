const config = require('./config');

const axios = require('axios');
const cheerio = require('cheerio');

const { App, LogLevel, ExpressReceiver } = require('@slack/bolt');

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
 * @param {marketplaceUrl} string URL of marketplace URL to
 *   search for the orgnization.
 * @param {rankCount} int A running counter for determining
 *   an organization's rank across multiple pages.
 * @return {int} Whether something occurred.
 */
function getDrupalMarketplaceData(marketplaceUrl, rankCount = 0) {
  return axios.get(marketplaceUrl)
    .then((marketplaceResponse) => {
      const html = marketplaceResponse.data;
      const $ = cheerio.load(html, { xmlMode: false });
      console.log($('.view-drupalorg-organizations .view-content').children().length);
      console.log($(`#node-${config.drupalOrganizationNodeId} h2`).text());
      // Determine if Chromatic is listed on the current page.
      if ($(`#node-${config.drupalOrganizationNodeId}`).length) {
        // Find the position of Chromatic on the page.
        const foundRank = rankCount + $(`#node-${config.drupalOrganizationNodeId}`).parent().prevAll().length + 1;
        return foundRank;
      }
      // Chromatic is not on the current page, go to the next page.
      const nextPageUrl = config.drupalOrgBaseUrl + $('.pager .pager-next a').attr('href');
      console.log(nextPageUrl);
      const updatedRank = rankCount + $('.view-drupalorg-organizations .view-content').children().length;
      return getDrupalMarketplaceData(nextPageUrl, updatedRank);
    })
    .catch((error) => {
      console.error(error);
    });
}

const drupalOrgPayloadBlocks = (
  chqDrupalIssueCreditCount,
  chqDrupalProjectsSupported,
  marketplaceRank,
  marketplacePage,
) => {
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
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:shopping_trolley: <https://www.drupal.org/drupal-services?page=${marketplacePage}|Marketplace> rank: ${marketplaceRank}`,
    },
  });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:female-technologist: Issue credit count: ${chqDrupalIssueCreditCount}`,
    },
  });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:female-construction-worker: Supported projects: ${chqDrupalProjectsSupported}`,
    },
  });

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

async function slackNotificationPayload(channelId, userId, responseType) {
  const [chqNodeResponse, marketplaceRank] = await Promise.all([
    axios.get(`https://www.drupal.org/api-d7/node/${config.drupalOrganizationNodeId}.json`),
    getDrupalMarketplaceData(`${config.drupalOrgBaseUrl}${config.drupalOrgMarketplacePath}`),
  ]);

  const chqDrupalIssueCreditCount = chqNodeResponse.data.field_org_issue_credit_count;
  const chqDrupalProjectsSupported = chqNodeResponse.data.projects_supported.length;

  const payload = {
    token: config.slackBotToken,
    channel: channelId,
    user: userId,
    response_type: responseType,
    text: '',
    attachments: [
      {
        blocks: drupalOrgPayloadBlocks(
          chqDrupalIssueCreditCount,
          chqDrupalProjectsSupported,
          marketplaceRank,
          Math.floor(marketplaceRank / 25),
        ),
      },
    ],
  };
  return payload;
}

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

  console.log(command);
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
    const channelId = config.debugMode ?
      config.channels.sandboxId :
      config.channels.defaultChannelId;
    const payload = await slackNotificationPayload(channelId, null, 'in_channel');
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
