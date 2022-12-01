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
    primaryText: process.env.SLACK_NOTIFICATION_TEXT || 'Drupal.org Organization Statistics :zap:',
    trackedHighText: process.env.SLACK_NOTIFICATION_TRACKED_HIGH_TEXT || ':chart_with_upwards_trend: _*An all-time tracked high*_. :sports_medal:',
    trackedWeeklyIncreasingText: process.env.SLACK_NOTIFICATION_TRACKED_WEEKLY_INCREASING_TEXT || ':chart_with_upwards_trend: _Trending up from last week\'s count of_',
    downFromTrackedHighText: process.env.SLACK_NOTIFICATION_DOWN_FROM_TRACKED_HIGH_TEXT || ':chart_with_downwards_trend: Down from a tracked high of',
  },
  keyValueDefaults: {
    weeklyTimestamp: 'org_data_weekly_timestamp',
    issueCreditCountMaxVarKey: 'org_issue_credit_count_max',
    issueCreditCountLastWeekVarKey: 'org_issue_credit_count_last_week',
    marketplaceRankMinVarKey: 'org_marketplace_rank_min',
    projectsSupportedMaxVarKey: 'org_projects_supported_max',
    caseStudiesPublishedMaxVarKey: 'org_case_studies_max',
  },
};
