module.exports = {
  debugMode: process.env.DEBUG_MODE === 'true',
  slackBotToken: process.env.SLACK_BOT_TOKEN,
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET,
  chromaticToken: process.env.CHROMATIC_TOKEN,
  channels: {
    announcementsId: 'C03FBG24G',
    openSourceId: 'C0J8SLT1V',
    sandboxId: process.env.SANDBOX_CHANNEL_ID,
  },
  chromaticDrupalOrgNid: 2127245,
  drupalOrgBaseUrl: 'https://www.drupal.org',
  drupalOrgMarketplacePath: '/drupal-services',
};
