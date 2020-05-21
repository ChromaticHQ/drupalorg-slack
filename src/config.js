module.exports = {
  verboseMode: process.env.VERBOSE_MODE === 'true',
  slackBotToken: process.env.SLACK_BOT_TOKEN,
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET,
  orgToken: process.env.ORG_TOKEN,
  channelId: process.env.DEBUG_MODE === 'true' ? process.env.SANDBOX_CHANNEL_ID : process.env.DEFAULT_CHANNEL_ID,
  drupalOrganizationNodeId: process.env.DRUPAL_ORG_NODE_ID,
  drupalOrgBaseUrl: 'https://www.drupal.org',
  drupalOrgMarketplacePath: '/drupal-services',
  slackNotificationText: {
    primaryText: process.env.SLACK_NOTIFICATION_TEXT ? process.env.SLACK_NOTIFICATION_TEXT : 'Drupal.org Organization Statistics :zap:',
    trackedHighText: process.env.SLACK_NOTIFICATION_TRACKED_HIGH_TEXT ? process.env.SLACK_NOTIFICATION_TRACKED_HIGH_TEXT : ':chart_with_upwards_trend: _*An all-time tracked high*_. :sports_medal:',
    downFromTrackedHighText: process.env.SLACK_NOTIFICATION_DOWN_FROM_TRACKED_HIGH_TEXT ? process.env.SLACK_NOTIFICATION_DOWN_FROM_TRACKED_HIGH_TEXT : ':chart_with_downwards_trend: Down from a tracked high of',
  },
  keyValueDefaults: {
    issueCreditCountMaxVarKey: 'org_issue_credit_count_max',
    marketplaceRankMinVarKey: 'org_marketplace_rank_min',
    projectsSupportedMaxVarKey: 'org_projects_supported_max',
    caseStudiesPublishedMaxVarKey: 'org_case_studies_max',
  },
};
