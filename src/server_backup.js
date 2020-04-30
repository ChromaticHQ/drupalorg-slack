// server.js

const config = require('./config');

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
let cheerio = require('cheerio');
const cheerioAdv = require('cheerio-advanced-selectors');

cheerio = cheerioAdv.wrap(cheerio);

// Configure Slack web client.
const { WebClient } = require('@slack/web-api');

const slackWebClient = new WebClient(config.slackToken);
const slackVerificationToken = config.slackVerificationToken;

const iftttToken = process.env.IFTTT_TOKEN;

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const chromaticChannelId = 'C02AWL8TM';
const sandboxChannelId = 'C8SK70Z63';
const debugMode = (process.env.DEBUG_MODE === 'true');

const drupalOrgPayloadBlocks = (response) => {
  const orgRankNew = 554;
  const orgRankOld = 900;
  const blocks = [];
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `Chromatic's Drupal.org rank is now ${orgRankNew}. Last week it was ${orgRankOld}.`
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

const findChqArticlesInNewsletter = (newsletterHtml) => {
  const $ = cheerio.load(newsletterHtml);
  const chqArticles = [];
  let linkUrl;
  $('.node-issue .node-title a').each((i, element) => {
    linkUrl = $(element).attr('href');
    if (linkUrl.includes('chromatichq.com')) {
      const chqArticle = {
        title: $(element).text(),
        link: linkUrl.split('?').shift(),
      };
      chqArticles.push(chqArticle);
    }
  });
  return chqArticles;
};

const getWeeklyDropIssueTitle = (newsletterHtml) => {
  const $ = cheerio.load(newsletterHtml);
  return $('h1').text();
};

app.get('/', (request, response, next) => {
  response.send('<h2>The CHQ Drupal.org app is running</h2> <p>Follow the' +
  ' instructions in the README to configure the Slack App and your' +
  ' environment variables.</p>');
});

app.post('/commands', (request, response, next) => {
  if (request.body.token === slackVerificationToken && request.body.command === '/dorank') {
    const chromaticOrgUrl = 'https://www.drupal.org/api-d7/node/2127245.json';
    axios.get(chromaticOrgUrl)
      .then((apiResponse) => {
        if (apiResponse.status === 200) {
          return 99;
          const json = apiResponse.data;
          return field_org_issue_credit_count;
        }
        return next();
      })
      .then((chqDrupalOrgRank) => {
        console.log(request.body);
        const payload = {
          channel: request.body.channel_id,
          user: request.body.user_id,
          text: 'Drupal.org Rank :drupal:',
          attachments: [
            {
              blocks: drupalOrgPayloadBlocks(response)
            }
          ]
        };
        return slackWebClient.chat.postEphemeral(payload);
      })
      .then(slackPostResponse => console.log('Message sent: ', slackPostResponse))
      .catch((error) => {
        console.error(error);
        console.log(error.data.response_metadata);
      });
    response.status(200);
    return response.send();
  }
  return next();
});

// POST notification coming from IFTTT.
app.post('/weeklydrop', (request, response, next) => {
  if (request.body.token !== iftttToken) {
    response.status(403);
    return next();
  }

  let issueTitle;
  const issueUrl = request.body.issue_url;
  axios.get(issueUrl)
    .then((newsletterIssueResponse) => {
      if (newsletterIssueResponse.status !== 200) {
        return next();
      }
      issueTitle = getWeeklyDropIssueTitle(newsletterIssueResponse.data);
      return findChqArticlesInNewsletter(newsletterIssueResponse.data);
    })
    .then((chqArticles) => {
      // Allow overriding of #chromatic default with sandbox channel.
      const channelId = debugMode ? sandboxChannelId : chromaticChannelId;
      const newsletterPayload = newsletterNotificationPayload(channelId, issueTitle, issueUrl, chqArticles);
      return slackWebClient.chat.postMessage(newsletterPayload);
    })
    .then(slackPostResponse => console.log('Message sent: ', slackPostResponse.ts))
    .catch((error) => {
      console.error(error);
    });
  response.status(200);
  return response.send();
});

// Listen for requests.
const listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});
