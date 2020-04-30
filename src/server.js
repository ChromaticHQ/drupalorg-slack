const config = require('./config');

const axios = require('axios');
let cheerio = require('cheerio');

const { App, LogLevel, ExpressReceiver } = require('@slack/bolt');
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET
});
const app = new App({
  receiver: receiver,
  token: config.slackBotToken,
  logLevel: LogLevel.DEBUG,
});

/* Add functionality here */

// function getDrupalOrgNode(nid) {
//   return axios.get(`https://www.drupal.org/api-d7/node/${nid}.json`);
// }

function getDrupalMarketplaceData(marketplaceUrl, rankCount = 0) {
  return axios.get(marketplaceUrl)
    .then(marketplaceResponse => {
      const html = marketplaceResponse.data;
      const $ = cheerio.load(html, { xmlMode: false });
      console.log($('.view-drupalorg-organizations .view-content').children().length);
      console.log($(`#node-${config.chromaticDrupalOrgNid} h2`).text());
      // Determine if Chromatic is listed on the current page.
      if ($(`#node-${config.chromaticDrupalOrgNid}`).length) {
        // @TODO: Get count.
        console.log('FOUND');
        // Find the position of Chromatic on the page.
        const foundRank = rankCount + $(`#node-${config.chromaticDrupalOrgNid}`).parent().prevAll().length + 1;
        return foundRank;
      }
      else {
        // Chromatic is not on the current page, go to the next page.
        const nextPageUrl = config.drupalOrgBaseUrl + $('.pager .pager-next a').attr('href');
        console.log(nextPageUrl);
        rankCount = rankCount + $('.view-drupalorg-organizations .view-content').children().length;
        return getDrupalMarketplaceData(nextPageUrl, rankCount);
      }
  })
  .catch(error => {
    console.error(error);
  })
}

const drupalOrgPayloadBlocks = (chqDrupalIssueCreditCount, chqDrupalProjectsSupported, marketplaceRank, marketplacePage) => {
  const blocks = [];
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `<https://www.drupal.org/drupal-services?page=${marketplacePage}|Marketplace> rank: ${marketplaceRank}`
    }
  });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `Issue credit count: ${chqDrupalIssueCreditCount}`
    }
  });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `Supported projects: ${chqDrupalProjectsSupported}`
    }
  });
  
  // Footer.
  blocks.push({
    type: 'divider'
  });
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: 'For more info, see https://www.drupal.org/chromatic.'
      }
    ]
  });
  return blocks;
};

// Listen for a slash command.
app.command('/dorank', async ({ command, ack, respond }) => {
  // Acknowledge Slack command request.
  await ack();
  
  const drupalOrgMarketplacePageOne = `${config.drupalOrgBaseUrl}${config.drupalOrgMarketplacePath}`;
  try {
    const [ chqNodeResponse, marketplaceRank ] = await Promise.all([ 
      axios.get(`https://www.drupal.org/api-d7/node/${config.chromaticDrupalOrgNid}.json`), 
      getDrupalMarketplaceData(drupalOrgMarketplacePageOne),
    ]);
  
    const chqDrupalIssueCreditCount = chqNodeResponse.data.field_org_issue_credit_count;
    const chqDrupalProjectsSupported = chqNodeResponse.data.projects_supported.length;

    console.log(command);
    const payload = {
      token: config.slackBotToken,
      channel: command.channel_id,
      user: command.user_id,
      response_type: 'ephemeral',
      text: 'Chromatic `<https://drupal.org/chromatic|drupal.org>` Statistics :chromatic::drupal:',
      attachments: [
        {
          blocks: drupalOrgPayloadBlocks(chqDrupalIssueCreditCount, chqDrupalProjectsSupported, marketplaceRank, Math.floor(marketplaceRank / 25))
        }
      ]
    };
    return await respond(payload);
  }
  catch(error) {
    console.error(error);
  }
});

// This endpoint is triggered by a non-Slack event like a Jenkins job for a 
// weekly notification in the configured announcements channel.
receiver.app.post('/triggers', (request, response, next) => {
  if (request.query.token !== config.chromaticToken) {
    response.status(403);
    return response.send();
  }
  
  axios
    .get(config.bamboo.whosOutUrl, config.bamboo.apiRequestConfig)
    .then(response => {
      if (response.status === 200) {
        // Allow overriding of #chromatic default with sandbox channel.
        const channelId = config.debugMode ? config.channels.sandboxId : config.channels.announcementsId;
        console.log(`Debug mode: ${config.debugMode ? 'ON' : 'OFF'}`);
        console.log(`Sending notification to channel: ${channelId}`);
        
        payload = {
          channel: channelId,
          text: config.whosOutMessageText,
          attachments: [
            {
              blocks: whosOutPayloadBlocks(response)
            }
          ]
        };
        return slackWebClient.chat.postMessage(payload);
      }
      return next();
    })
    .catch(error => {
      console.error(error);
    });
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