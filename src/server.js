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

function getDrupalMarketplaceData(marketplaceUrl, rankCount = 0) {
  return axios.get(marketplaceUrl)
    .then((marketplaceResponse) => {
      const html = marketplaceResponse.data;
      const $ = cheerio.load(html, { xmlMode: false });
      console.log($('.view-drupalorg-organizations .view-content').children().length);
      console.log($(`#node-${config.chromaticDrupalOrgNid} h2`).text());
      // Determine if Chromatic is listed on the current page.
      if ($(`#node-${config.chromaticDrupalOrgNid}`).length) {
        console.log('FOUND');
        // Find the position of Chromatic on the page.
        const foundRank = rankCount + $(`#node-${config.chromaticDrupalOrgNid}`).parent().prevAll().length + 1;
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
      text: `Chromatic <https://drupal.org/chromatic|drupal.org> Statistics :chromatic::zap::drupal:`,
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
    axios.get(`https://www.drupal.org/api-d7/node/${config.chromaticDrupalOrgNid}.json`),
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
  console.log(payload.attachments[0]);
  return payload;
}

// Listen for a slash command.
app.command('/dorank', async ({ command, ack, respond }) => {
  // Acknowledge Slack command request.
  await ack();

  console.log(command);
  try {
    const payload = await slackNotificationPayload(command.channel_id, command.user_id, 'ephemeral');
    return await respond(payload);
  } catch (error) {
    console.error(error);
  }
});

// This endpoint is triggered by a non-Slack event like a Jenkins job for a
// weekly notification in the configured announcements channel.
receiver.app.post('/triggers', async (request, response, next) => {
  if (request.query.token !== config.chromaticToken) {
    response.status(403);
    return response.send();
  }
  try {
    const channelId = config.debugMode ?
      config.channels.sandboxId :
      config.channels.openSourceId;
    const payload = await slackNotificationPayload(channelId, null, 'in_channel');
    console.log(payload);
    return app.client.chat.postMessage(payload);
  } catch (error) {
    console.error(error);
  }

  // return app.client.chat.postEphemeral(payload);
  response.status(200);
  return response.send();
});

receiver.app.get('/', (_, res) => {
  res.status(200).send(); // respond 200 OK to the default health check method
});

(async () => {
  // Start the app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️ Bolt app is running!');
})();
