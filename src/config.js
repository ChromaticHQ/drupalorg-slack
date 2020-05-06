module.exports = {
  verboseMode: process.env.VERBOSE_MODE === 'true',
  slackBotToken: process.env.SLACK_BOT_TOKEN,
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET,
  orgToken: process.env.ORG_TOKEN,
  channelId: process.env.DEBUG_MODE === 'true' ? process.env.SANDBOX_CHANNEL_ID : process.env.DEFAULT_CHANNEL_ID,
  drupalOrganizationNodeId: process.env.DRUPAL_ORG_NODE_ID,
  drupalOrgBaseUrl: 'https://www.drupal.org',
  drupalOrgMarketplacePath: '/drupal-services',
  slackNotificationText: process.env.SLACK_NOTIFICATION_TEXT,
  keyValueDefaults: {
    issueCreditCountMaxVarKey: 'org_issue_credit_count_max',
    marketplaceRankMinVarKey: 'org_marketplace_rank_min',
    projectsSupportedMaxVarKey: 'org_projects_supported_max',
    caseStudiesPublishedMaxVarKey: 'org_case_studies_max',
  },
};
