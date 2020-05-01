module.exports = {
  debugMode: process.env.DEBUG_MODE === 'true',
  slackBotToken: process.env.SLACK_BOT_TOKEN,
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET,
  orgToken: process.env.ORG_TOKEN,
  channels: {
    defaultChannelId: process.env.DEFAULT_CHANNEL_ID,
    sandboxId: process.env.SANDBOX_CHANNEL_ID,
  },
  drupalOrganizationNodeId: process.env.DRUPAL_ORG_NODE_ID,
  drupalOrgBaseUrl: 'https://www.drupal.org',
  drupalOrgMarketplacePath: '/drupal-services',
  slackNotificationText: process.env.SLACK_NOTIFICATION_TEXT,
};
